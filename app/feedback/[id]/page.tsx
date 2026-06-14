'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, Send, Check, Watch, ArrowLeft, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';

export default function FeedbackPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = createClient();

  const invoiceId = params.id as string;
  const token = searchParams.get('token');

  const [service, setService] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchService();
  }, [invoiceId, token]);

  const fetchService = async () => {
    setLoading(true);
    try {
      const { data: serviceData } = await supabase
        .from('service_orders')
        .select('id, invoice_number, customer_name, watch_brand, watch_model, status, token, assigned_teknisi_id')
        .eq('invoice_number', invoiceId)
        .single();

      if (!serviceData) {
        setError('Service not found');
        setLoading(false);
        return;
      }

      if (serviceData.token !== token) {
        setError('Invalid or expired link');
        setLoading(false);
        return;
      }

      if (serviceData.status !== 'completed') {
        setError('Feedback is only available for completed services');
        setLoading(false);
        return;
      }

      // Check if already submitted
      const { data: existing } = await supabase
        .from('feedbacks')
        .select('id')
        .eq('service_order_id', serviceData.id)
        .maybeSingle();

      if (existing) {
        setAlreadySubmitted(true);
      }

      setService(serviceData);
    } catch (err) {
      setError('Failed to load service data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error('Please select a rating');
      return;
    }
    if (!service) return;

    setSubmitting(true);
    try {
      const { error: insertError } = await supabase.from('feedbacks').insert({
        service_order_id: service.id,
        customer_name: service.customer_name,
        rating,
        comment: comment.trim() || null,
        teknisi_id: service.assigned_teknisi_id || null,
      });

      if (insertError) throw insertError;

      // Notify owner about new feedback
      await supabase.from('notifications').insert({
        type: 'feedback',
        title: 'New Customer Feedback',
        message: `${service.customer_name} rated service ${service.invoice_number} with ${rating} stars`,
        data: { service_id: service.id, invoice: service.invoice_number, rating },
      });

      setSubmitted(true);
      toast.success('Thank you for your feedback!');
    } catch (err: any) {
      if (err.code === '23505') {
        setAlreadySubmitted(true);
      } else {
        toast.error('Failed to submit feedback');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const ratingLabels = ['', 'Very Unsatisfied', 'Unsatisfied', 'Neutral', 'Satisfied', 'Very Satisfied'];
  const ratingColors = ['', 'text-red-600', 'text-orange-500', 'text-yellow-600', 'text-blue-600', 'text-green-600'];

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-black border-t-[#FF6B9D] mx-auto" />
          <p className="mt-4 font-mono font-bold">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="border-2 border-black shadow-[8px_8px_0_0_#000] p-8 max-w-sm w-full text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-[#FF6B9D]" />
          <h2 className="text-xl font-black font-mono mb-2">Oops!</h2>
          <p className="font-mono text-sm text-gray-600 mb-5">{error}</p>
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center gap-2 w-full py-2.5 border-2 border-black bg-white font-mono font-bold text-sm hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft size={16} />
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (alreadySubmitted) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="border-2 border-black shadow-[8px_8px_0_0_#000] p-8 max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-[#FFDE00] border-2 border-black flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black font-mono mb-2">Already Submitted</h2>
          <p className="font-mono text-sm text-gray-600 mb-5">
            You've already submitted feedback for this service. Thank you!
          </p>
          <button
            onClick={() => router.push(`/tracking/${invoiceId}?token=${token}`)}
            className="w-full py-2.5 bg-[#3B82F6] text-white border-2 border-black shadow-[4px_4px_0_0_#000] font-mono font-bold text-sm"
          >
            Back to Tracking
          </button>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="border-2 border-black shadow-[8px_8px_0_0_#000] p-8 max-w-sm w-full text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
            className="w-20 h-20 bg-[#FF6B9D] border-2 border-black flex items-center justify-center mx-auto mb-5"
          >
            <Check className="w-10 h-10 text-white" />
          </motion.div>
          <h2 className="text-3xl font-black font-mono mb-2">THANK YOU!</h2>
          <p className="font-mono text-gray-600 mb-1">Your feedback has been submitted.</p>
          <div className="flex items-center justify-center gap-1 my-4">
            {[1, 2, 3, 4, 5].map(star => (
              <Star
                key={star}
                size={28}
                className={star <= rating ? 'text-[#FFDE00] fill-[#FFDE00]' : 'text-gray-300'}
              />
            ))}
          </div>
          <p className={`font-mono font-bold text-lg mb-5 ${ratingColors[rating]}`}>
            {ratingLabels[rating]}
          </p>
          <button
            onClick={() => router.push(`/tracking/${invoiceId}?token=${token}`)}
            className="w-full py-2.5 bg-[#3B82F6] text-white border-2 border-black shadow-[4px_4px_0_0_#000] font-mono font-bold text-sm hover:shadow-[2px_2px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
          >
            Back to Tracking
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-2 border-black shadow-[8px_8px_0_0_#000] p-6 sm:p-8 max-w-md w-full"
      >
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-[#FF6B9D] border-2 border-black flex items-center justify-center mx-auto mb-3">
            <Watch className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-black font-mono">RATE YOUR SERVICE</h1>
          <p className="font-mono text-sm text-gray-600 mt-1">How was your experience?</p>
        </div>

        {/* Service Info */}
        <div className="bg-[#FFDE00] border-2 border-black p-3 mb-6">
          <p className="font-black font-mono text-sm">{service?.invoice_number}</p>
          <p className="font-mono text-xs">{service?.customer_name}</p>
          {service?.watch_brand && (
            <p className="font-mono text-xs text-gray-700">{service.watch_brand} {service?.watch_model}</p>
          )}
        </div>

        {/* Star Rating */}
        <div className="mb-6">
          <label className="block font-black font-mono text-sm mb-3 uppercase">Your Rating</label>
          <div className="flex items-center justify-center gap-2">
            {[1, 2, 3, 4, 5].map(star => (
              <motion.button
                key={star}
                whileHover={{ scale: 1.2 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                className="focus:outline-none"
              >
                <Star
                  size={40}
                  className={`transition-colors ${
                    star <= (hoverRating || rating)
                      ? 'text-[#FFDE00] fill-[#FFDE00]'
                      : 'text-gray-300'
                  }`}
                />
              </motion.button>
            ))}
          </div>
          <AnimatePresence>
            {(rating > 0 || hoverRating > 0) && (
              <motion.p
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`text-center font-mono font-bold mt-2 ${ratingColors[hoverRating || rating]}`}
              >
                {ratingLabels[hoverRating || rating]}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* Comment */}
        <div className="mb-6">
          <label className="block font-black font-mono text-sm mb-2 uppercase">Comment (Optional)</label>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Tell us about your experience..."
            rows={4}
            className="w-full px-3 py-2.5 border-2 border-black font-mono text-sm resize-none focus:outline-none shadow-[3px_3px_0_0_#000] focus:shadow-none focus:translate-x-[3px] focus:translate-y-[3px] transition-all"
          />
          <p className="text-xs font-mono text-gray-400 text-right mt-1">{comment.length}/500</p>
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={submitting || rating === 0}
          className="w-full flex items-center justify-center gap-2 py-3 bg-[#FF6B9D] text-white border-2 border-black shadow-[4px_4px_0_0_#000] hover:shadow-[2px_2px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] font-mono font-black text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-x-0 disabled:hover:translate-y-0"
        >
          {submitting ? (
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
          ) : (
            <>
              <Send size={16} />
              SUBMIT FEEDBACK
            </>
          )}
        </button>

        <p className="text-center text-[10px] font-mono text-gray-400 mt-4">
          Your feedback helps us improve our service quality
        </p>
      </motion.div>
    </div>
  );
}
