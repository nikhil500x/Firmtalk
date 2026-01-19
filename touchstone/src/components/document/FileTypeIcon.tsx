'use client';

import { 
  File, 
  Folder, 
  FileText, 
  Image, 
  Video, 
  Music, 
  FileSpreadsheet, 
  Presentation,
  Archive,
  Code,
  FileCode,
  FileJson,
  FileType
} from 'lucide-react';

interface FileTypeIconProps {
  mimeType?: string;
  isFolder?: boolean;
  fileName?: string;
  className?: string;
}

export default function FileTypeIcon({ 
  mimeType, 
  isFolder, 
  fileName,
  className = 'w-5 h-5' 
}: FileTypeIconProps) {
  if (isFolder) {
    return <Folder className={`${className} text-blue-600`} />;
  }

  // Get file extension from filename if MIME type not available
  const extension = fileName?.split('.').pop()?.toLowerCase() || '';
  
  // Determine icon based on MIME type or extension
  const getIcon = () => {
    const mime = mimeType?.toLowerCase() || '';
    
    // Images
    if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp', 'ico'].includes(extension)) {
      return <Image className={`${className} text-green-600`} />;
    }
    
    // Videos
    if (mime.startsWith('video/') || ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv'].includes(extension)) {
      return <Video className={`${className} text-purple-600`} />;
    }
    
    // Audio
    if (mime.startsWith('audio/') || ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'].includes(extension)) {
      return <Music className={`${className} text-pink-600`} />;
    }
    
    // PDF
    if (mime === 'application/pdf' || extension === 'pdf') {
      return <FileText className={`${className} text-red-600`} />;
    }
    
    // Word documents
    if (
      mime.includes('wordprocessingml') || 
      mime.includes('msword') || 
      ['doc', 'docx'].includes(extension)
    ) {
      return <FileText className={`${className} text-blue-700`} />;
    }
    
    // Excel/Spreadsheets
    if (
      mime.includes('spreadsheetml') || 
      mime.includes('excel') || 
      ['xls', 'xlsx', 'csv'].includes(extension)
    ) {
      return <FileSpreadsheet className={`${className} text-green-700`} />;
    }
    
    // PowerPoint/Presentations
    if (
      mime.includes('presentationml') || 
      mime.includes('powerpoint') || 
      ['ppt', 'pptx'].includes(extension)
    ) {
      return <Presentation className={`${className} text-orange-600`} />;
    }
    
    // Archives
    if (
      mime.includes('zip') || 
      mime.includes('rar') || 
      mime.includes('tar') || 
      mime.includes('gzip') ||
      ['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(extension)
    ) {
      return <Archive className={`${className} text-yellow-600`} />;
    }
    
    // Code files
    if (
      ['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'cpp', 'c', 'cs', 'php', 'rb', 'go', 'rs', 'swift', 'kt'].includes(extension)
    ) {
      return <Code className={`${className} text-indigo-600`} />;
    }
    
    // Web files
    if (['html', 'htm', 'css', 'scss', 'sass', 'less'].includes(extension)) {
      return <FileCode className={`${className} text-blue-600`} />;
    }
    
    // JSON/Config files
    if (['json', 'xml', 'yaml', 'yml', 'toml', 'ini', 'conf'].includes(extension)) {
      return <FileJson className={`${className} text-amber-600`} />;
    }
    
    // Text files
    if (mime.startsWith('text/') || ['txt', 'md', 'markdown', 'rtf'].includes(extension)) {
      return <FileText className={`${className} text-gray-600`} />;
    }
    
    // Default file icon
    return <File className={`${className} text-gray-500`} />;
  };

  return getIcon();
}

