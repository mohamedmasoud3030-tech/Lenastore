import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useProject } from '../lib/ProjectContext';
import { Upload, X, File, FileText, Image as ImageIcon, Trash2, Eye, Download } from 'lucide-react';

interface AttachmentsProps {
  entityType: 'PROJECT' | 'SUPPLIER' | 'MATERIAL' | 'PURCHASE_REQUEST' | 'PURCHASE' | 'PAYMENT' | 'MOVEMENT';
  entityId: string;
}

export default function Attachments({ entityType, entityId }: AttachmentsProps) {
  const { project } = useProject();
  const [attachments, setAttachments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const fetchAttachments = async () => {
    if (!supabase || !project) return;
    try {
      const { data, error } = await supabase
        .from('attachments')
        .select('*')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setAttachments(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchAttachments();
  }, [entityId]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    // Validate type
    const validTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      alert('يجب أن يكون الملف بصيغة JPG, PNG أو PDF');
      return;
    }

    // Validate size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('حجم الملف يجب ألا يتجاوز 5 ميجابايت');
      return;
    }

    if (!supabase || !project) return;
    setUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
      const filePath = `${project.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('attachments')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase.from('attachments').insert([{
        project_id: project.id,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        file_path: filePath,
        entity_type: entityType,
        entity_id: entityId
      }]);

      if (dbError) throw dbError;
      
      fetchAttachments();
    } catch (e: any) {
      console.error(e);
      alert('حدث خطأ أثناء رفع الملف: ' + e.message);
    } finally {
      setUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleDelete = async (id: string, filePath: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا المرفق؟')) return;
    if (!supabase) return;

    try {
      // Remove from DB
      const { error: dbError } = await supabase.from('attachments').delete().eq('id', id);
      if (dbError) throw dbError;

      // Remove from Storage
      await supabase.storage.from('attachments').remove([filePath]);

      fetchAttachments();
    } catch (e) {
      console.error(e);
      alert('حدث خطأ أثناء الحذف');
    }
  };

  const handlePreview = async (filePath: string) => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase.storage.from('attachments').createSignedUrl(filePath, 60 * 60); // 1 hour
      if (error) throw error;
      if (data) {
        setPreviewUrl(data.signedUrl);
      }
    } catch (e) {
      console.error(e);
      alert('لا يمكن عرض الملف. قد لا تملك الصلاحية.');
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="bg-white shadow rounded-lg p-5 mt-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium text-gray-900">المرفقات</h3>
        <div>
          <label className={`inline-flex items-center gap-2 px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 cursor-pointer ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
            <Upload size={16} />
            {uploading ? 'جاري الرفع...' : 'رفع ملف'}
            <input type="file" className="hidden" accept=".jpg,.jpeg,.png,.pdf" onChange={handleFileUpload} disabled={uploading} />
          </label>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">جاري التحميل...</p>
      ) : attachments.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-4">لا توجد مرفقات.</p>
      ) : (
        <ul className="divide-y divide-gray-200">
          {attachments.map(att => (
            <li key={att.id} className="py-3 flex justify-between items-center">
              <div className="flex items-center gap-3 overflow-hidden">
                {att.file_type.includes('pdf') ? (
                  <FileText className="text-red-500 flex-shrink-0" size={24} />
                ) : (
                  <ImageIcon className="text-blue-500 flex-shrink-0" size={24} />
                )}
                <div className="truncate">
                  <p className="text-sm font-medium text-gray-900 truncate" dir="ltr">{att.file_name}</p>
                  <p className="text-xs text-gray-500">{formatSize(att.file_size)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => handlePreview(att.file_path)} className="p-1 text-gray-400 hover:text-blue-600">
                  <Eye size={18} />
                </button>
                <button onClick={async () => {
                   if (!supabase) return;
                   try {
                     const { data, error } = await supabase.storage.from('attachments').createSignedUrl(att.file_path, 60 * 60, { download: true });
                     if (error) throw error;
                     if (data) window.open(data.signedUrl, '_blank');
                   } catch (e) {
                     console.error(e);
                     alert('لا يمكن تنزيل الملف. قد لا تملك الصلاحية.');
                   }
                }} className="p-1 text-gray-400 hover:text-green-600" title="تحميل">
                  <Download size={18} />
                </button>
                <button onClick={() => handleDelete(att.id, att.file_path)} className="p-1 text-gray-400 hover:text-red-600">
                  <Trash2 size={18} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Preview Modal */}
      {previewUrl && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black bg-opacity-75" onClick={() => setPreviewUrl(null)}>
          <div className="relative max-w-4xl max-h-[90vh] w-full" onClick={e => e.stopPropagation()}>
            <button onClick={() => setPreviewUrl(null)} className="absolute -top-10 right-0 text-white hover:text-gray-300">
              <X size={32} />
            </button>
            {previewUrl.includes('.pdf') || previewUrl.toLowerCase().endsWith('.pdf') ? (
              <iframe src={previewUrl} className="w-full h-[80vh] bg-white rounded" title="PDF Preview" />
            ) : (
              <img src={previewUrl} alt="Preview" className="max-w-full max-h-[80vh] object-contain mx-auto rounded" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
