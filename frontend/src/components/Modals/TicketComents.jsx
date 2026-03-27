import { ScrollArea } from "@/components/ui/scroll-area";
import { useState } from "react";
import { Avatar } from "../Avatar";

export default function TicketComments() {

    const [newComment, setNewComment] = useState("");
  
    const comments = [
    {
        id: "c1",
        content: "Upravo sam počeo raditi na ovome. Izgleda da će trebati malo više vremena za bazu podataka.",
        createdAt: "2026-03-27T10:00:00Z",
        author: {
        fullName: "Primary Admin",
        avatarUrl: null, 
        }
    },
    {
        id: "c2",
        content: "Dogovoreno. Javi ako zapneš kod migracija, ja sam slobodan poslije 14h.",
        createdAt: "2026-03-27T11:30:00Z",
        author: {
        fullName: "Marko Marić",
        avatarUrl: "https://github.com/shadcn.png",
        }
    },
    {
        id: "c3",
        content: "Sve je spremno za testiranje na staging okruženju! 🚀",
        createdAt: "2026-03-27T14:15:00Z",
        author: {
        fullName: "Ana Kovač",
        avatarUrl: null,
        }
    }
    ];

    return (
    <div className="p-4">

    <ScrollArea className="h-[400px] w-full pr-4">
        {comments.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-gray-500">
            No comments yet.
            </div>
        ) : (
            <div className="space-y-4">
            {comments.map((comment) => (
                <div key={comment.id} className="flex gap-4 group transition-colors hover:bg-gray-50/50 p-2 rounded-lg">
                   <div className="flex-shrink-0 mt-1">
                    <Avatar users={[comment.author]} />
                    </div>
                    <div className="flex flex-col flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-semibold text-gray-900 truncate">
                                {comment.author.fullName}
                            </span>
                            <span className="text-[10px] text-gray-400 font-medium whitespace-nowrap">
                                {comment.createdAt && new Date(comment.createdAt).toLocaleDateString()}
                            </span>
                        </div>
                        <div className="text-sm text-gray-600 leading-relaxed break-words">
                            {comment.content}
                        </div>
                    </div>
                </div>
            
            ))}
            </div>
        )}

    </ScrollArea>

    <div className="mt-4 border-t pt-4 space-y-3">
        <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Napiši komentar..."
            className="w-full min-h-[80px] rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm outline-none transition-all focus:border-blue-300 focus:ring-2 focus:ring-blue-100 resize-none"
        />
        
        <div className="flex justify-end">
            <button 
                disabled={!newComment.trim()}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                    !newComment.trim() 
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed" 
                    : "bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
                }`}
                onClick={() => {
                    console.log("Slanje komentara:", newComment);
                    setNewComment(""); 
                }}
            >
                Post Comment
            </button>
        </div>
    </div>

    </div>
  );
}