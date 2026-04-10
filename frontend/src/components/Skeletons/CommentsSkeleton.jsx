import React from "react";

const CommentsSkeleton = () => {
  return (
    <div className="flex flex-col gap-4 p-4 animate-pulse">
      <div className="h-4 w-24 bg-gray-100 rounded mb-2"></div>
      
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex gap-3">
          <div className="h-8 w-8 rounded-full bg-gray-200 flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-32 bg-gray-200 rounded" />
            <div className="h-3 w-full bg-gray-100 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
};

export default CommentsSkeleton;