'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Star, Search, TrendingUp, MessageSquare, User, Calendar } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

interface Feedback {
  id: string;
  service_order_id: string;
  customer_name: string;
  rating: number;
  comment: string | null;
  created_at: string;
  service_orders?: {
    invoice_number: string;
    watch_brand: string;
  };
  profiles?: {
    full_name: string;
  };
}

export default function FeedbackList() {
  const supabase = createClient();
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRating, setFilterRating] = useState<number | null>(null);
  const [stats, setStats] = useState({ avg: 0, total: 0, distribution: [0, 0, 0, 0, 0] });

  useEffect(() => {
    fetchFeedbacks();
  }, []);

  const fetchFeedbacks = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('feedbacks')
      .select(`
        *,
        service_orders(invoice_number, watch_brand)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(error);
    } else {
      const fb = data || [];
      setFeedbacks(fb as any);

      // Calculate stats
      if (fb.length > 0) {
        const avg = fb.reduce((sum, f) => sum + f.rating, 0) / fb.length;
        const dist = [0, 0, 0, 0, 0];
        fb.forEach(f => { dist[f.rating - 1]++; });
        setStats({ avg: Math.round(avg * 10) / 10, total: fb.length, distribution: dist });
      }
    }
    setLoading(false);
  };

  const filtered = feedbacks.filter(f => {
    const matchSearch = !search ||
      f.customer_name.toLowerCase().includes(search.toLowerCase()) ||
      (f.comment || '').toLowerCase().includes(search.toLowerCase());
    const matchRating = filterRating === null || f.rating === filterRating;
    return matchSearch && matchRating;
  });

  const StarDisplay = ({ rating, size = 16 }: { rating: number; size?: number }) => (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(star => (
        <Star
          key={star}
          size={size}
          className={star <= rating ? 'text-[#FFDE00] fill-[#FFDE00]' : 'text-gray-300'}
        />
      ))}
    </div>
  );

  const ratingColor = (r: number) => {
    if (r >= 4) return 'bg-green-100 text-green-800 border-green-800';
    if (r === 3) return 'bg-[#FFDE00] text-black border-black';
    return 'bg-[#FF6B9D] text-white border-black';
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-[#FF6B9D] border-2 border-black flex items-center justify-center shadow-[4px_4px_0_0_#000]">
          <Star className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-black font-mono">CUSTOMER FEEDBACK</h2>
          <p className="text-xs font-mono">{stats.total} total reviews</p>
        </div>
      </div>

      {/* Stats Overview */}
      {!loading && stats.total > 0 && (
        <div className="grid sm:grid-cols-2 gap-5 mb-6">
          <div className="border-2 border-black shadow-[6px_6px_0_0_#000] p-5 bg-[#FFDE00]">
            <div className="flex items-end gap-3 mb-3">
              <span className="text-6xl font-black font-mono">{stats.avg}</span>
              <div>
                <StarDisplay rating={Math.round(stats.avg)} size={20} />
                <p className="text-sm font-mono font-bold mt-1">{stats.total} reviews</p>
              </div>
            </div>
            <p className="text-xs font-mono font-bold uppercase">Average Rating</p>
          </div>

          <div className="border-2 border-black shadow-[6px_6px_0_0_#000] p-5 bg-white">
            <p className="text-xs font-mono font-bold uppercase mb-3">Rating Distribution</p>
            <div className="space-y-1.5">
              {[5, 4, 3, 2, 1].map(star => {
                const count = stats.distribution[star - 1];
                const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
                return (
                  <div key={star} className="flex items-center gap-2">
                    <div className="flex items-center gap-1 w-12">
                      <Star size={10} className="text-[#FFDE00] fill-[#FFDE00]" />
                      <span className="text-xs font-mono font-bold">{star}</span>
                    </div>
                    <div className="flex-1 h-3 bg-gray-100 border border-black overflow-hidden">
                      <div
                        className="h-full bg-[#FF6B9D] transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono w-6 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" />
          <input
            type="text"
            placeholder="Search customer or comment..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border-2 border-black font-mono text-sm focus:outline-none shadow-[3px_3px_0_0_#000] focus:shadow-none focus:translate-x-[3px] focus:translate-y-[3px] transition-all"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setFilterRating(null)}
            className={`px-3 py-2 border-2 border-black font-mono font-bold text-sm transition-all ${filterRating === null ? 'bg-black text-white shadow-[3px_3px_0_0_#000]' : 'bg-white hover:bg-gray-100'}`}
          >
            ALL
          </button>
          {[5, 4, 3, 2, 1].map(r => (
            <button
              key={r}
              onClick={() => setFilterRating(filterRating === r ? null : r)}
              className={`px-3 py-2 border-2 border-black font-mono font-bold text-sm transition-all flex items-center gap-1 ${filterRating === r ? 'bg-[#FFDE00] shadow-[3px_3px_0_0_#000]' : 'bg-white hover:bg-[#FFDE00]/30'}`}
            >
              <Star size={12} className="fill-current text-current" />
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="border-2 border-black p-8 text-center font-mono">Loading feedback...</div>
      ) : filtered.length === 0 ? (
        <div className="border-2 border-black p-12 text-center shadow-[6px_6px_0_0_#000]">
          <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-mono font-bold">No feedback yet</p>
          <p className="text-sm font-mono text-gray-500 mt-1">Customer ratings will appear here</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((fb, i) => (
            <motion.div
              key={fb.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="border-2 border-black shadow-[4px_4px_0_0_#000] bg-white p-5 hover:shadow-[6px_6px_0_0_#000] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 bg-[#FF6B9D] border-2 border-black flex items-center justify-center flex-shrink-0">
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black font-mono text-sm">{fb.customer_name}</span>
                      <span className={`text-xs font-mono font-bold px-2 py-0.5 border ${ratingColor(fb.rating)}`}>
                        {fb.rating}.0 ★
                      </span>
                    </div>
                    <StarDisplay rating={fb.rating} size={14} />
                    {fb.comment && (
                      <p className="text-sm text-gray-700 mt-2 font-mono">"{fb.comment}"</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      {(fb as any).service_orders?.invoice_number && (
                        <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-0.5 border border-gray-300">
                          {(fb as any).service_orders.invoice_number}
                        </span>
                      )}
                      <span className="text-xs font-mono text-gray-400 flex items-center gap-1">
                        <Calendar size={10} />
                        {format(new Date(fb.created_at), 'dd MMM yyyy', { locale: id })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
