"use client";

import { Check } from "lucide-react";

interface StepIndicatorProps {
  steps: string[];
  current: number;
}

export default function StepIndicator({ steps, current }: StepIndicatorProps) {
  return (
    <div className="flex w-full items-center overflow-x-auto pb-1">
      {steps.map((step, idx) => {
        const isCompleted = idx < current;
        const isCurrent = idx === current;

        return (
          <div key={step} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors duration-150 ${
                  isCompleted
                  ? "bg-blue-600 text-white"
                    : isCurrent
                    ? "border-2 border-blue-600 text-blue-600 bg-white"
                    : "bg-gray-200 text-gray-400"
                }`}
              >
                {isCompleted ? <Check size={14} /> : idx + 1}
              </div>
              <span
                className={`text-[12px] mt-1.5 whitespace-nowrap ${
                  isCompleted || isCurrent ? "text-blue-600" : "text-gray-400"
                }`}
              >
                {step}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div
                className={`mb-5 mx-1 h-px w-10 shrink-0 transition-colors duration-150 sm:w-16 ${
                  idx < current ? "bg-blue-600" : "bg-gray-200"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
