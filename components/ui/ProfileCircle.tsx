"use client";

import React, { ChangeEvent } from "react";
import { LucideCamera } from "lucide-react";

interface ProfileCircleProps {
  image?: string;
  onUpload: (base64: string) => void;
  size?: "sm" | "md" | "lg";
  label?: string;
}

export default function ProfileCircle({ image, onUpload, size = "md", label }: ProfileCircleProps) {
  // Define responsive size constraints
  const sizeClasses = {
    sm: "w-12 h-12",
    md: "w-16 h-16",
    lg: "w-24 h-24"
  };

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (reader.result) {
          // Pass the Base64 string back to the parent component
          onUpload(reader.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="relative group cursor-pointer" aria-label={label || "Upload image"}>
      <div className={`${sizeClasses[size]} rounded-full bg-zinc-900 border border-purple-500/20 flex items-center justify-center overflow-hidden group-hover:border-purple-500 transition-all shadow-inner relative z-0`}>
        {image ? (
          <img src={image} alt="Profile" className="w-full h-full object-cover" />
        ) : (
          <LucideCamera size={size === "lg" ? 32 : 20} className="text-zinc-600 group-hover:text-purple-400 transition-colors" />
        )}
        
        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
          <LucideCamera size={size === "lg" ? 24 : 16} className="text-white" />
        </div>
      </div>

      {/* Hidden File Input */}
      <input 
        type="file" 
        accept="image/*"
        onChange={handleFile}
        className="absolute inset-0 opacity-0 cursor-pointer z-10" 
      />
    </div>
  );
}