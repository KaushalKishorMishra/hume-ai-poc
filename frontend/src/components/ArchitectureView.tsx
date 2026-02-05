import { ArrowLeft } from "lucide-react";

interface ArchitectureViewProps {
  onBack: () => void;
}

export const ArchitectureView = ({ onBack }: ArchitectureViewProps) => {
  return (
    <div className="flex flex-col items-center w-full max-w-5xl mx-auto px-4">
      <div className="w-full flex justify-start mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 hover:text-black transition-colors"
        >
          <ArrowLeft size={20} />
          <span>Back to Chat</span>
        </button>
      </div>

      <div className="w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-200">
        <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-bold text-gray-800 text-lg">System Architecture</h2>
          <span className="text-xs font-medium px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
            FigJam Live Embed
          </span>
        </div>
        
        <div className="aspect-video w-full">
          <iframe
            style={{ border: "none" }}
            width="100%"
            height="100%"
            src="https://embed.figma.com/board/BGcdxcnkukN9Lj1IgBI3tP/Hume-AI-PoC-Architecture-Flow?node-id=0-1&embed-host=share"
            allowFullScreen
          ></iframe>
        </div>
      </div>
      
      <div className="mt-6 text-center text-gray-500 text-sm">
        <p>This diagram represents the real-time interaction flow between the user, backend proxy, and Hume AI services.</p>
      </div>
    </div>
  );
};
