"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { FileText, Plus, Search, Edit, Trash2, X } from "lucide-react";
import toast from "react-hot-toast";

const defaultTemplates = [
  { id: "1", name: "Informasi Service Selesai", content: "Halo {nama},\n\nKami informasikan bahwa service untuk invoice {invoice} telah selesai dan siap diambil.\n\nTotal biaya: Rp {total}\n\nSilakan datang ke toko.\nTerima kasih." },
  { id: "2", name: "Konfirmasi Pengambilan", content: "Halo {nama},\n\nMohon konfirmasi kapan akan mengambil service {invoice}.\n\nTerima kasih." },
];

export default function TemplateManager() {
  const [templates, setTemplates] = useState(defaultTemplates);
  const [search, setSearch] = useState("");

  const filtered = search.trim()
    ? templates.filter(t => t.name.toLowerCase().includes(search.toLowerCase()))
    : templates;

  return (
    <div className="space-y-5">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900">Template Pesan</h1>
            <p className="text-sm text-slate-500">Template WhatsApp & notifikasi</p>
          </div>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari template..." className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10" />
        </div>
      </motion.div>

      <div className="grid gap-4">
        {filtered.map((t, i) => (
          <motion.div key={t.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-900">{t.name}</h3>
                  <pre className="mt-2 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 whitespace-pre-wrap font-sans">{t.content}</pre>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"><Edit className="w-4 h-4" /></button>
                  <button className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-all"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}