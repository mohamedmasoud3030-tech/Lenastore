import React from 'react';

export const LoadingSkeleton: React.FC<{ rows?: number }> = ({ rows = 4 }) => {
  return (
    <div className="w-full space-y-4 animate-pulse p-4">
      <div className="h-8 bg-slate-200 rounded-lg w-1/4"></div>
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-14 bg-slate-100 rounded-xl w-full"></div>
        ))}
      </div>
    </div>
  );
};
