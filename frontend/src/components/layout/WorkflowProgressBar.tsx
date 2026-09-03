'use client';

import React from 'react';
import Link from 'next/link';
import { BookOpen, FolderArchive, Layers, Check } from 'lucide-react';
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type WorkflowStep = 'PROJECTS' | 'DOSSIER' | 'STUDIO';

interface Props {
  currentStep: WorkflowStep;
  projectId?: string;
  projectName?: string;
  completedSteps?: WorkflowStep[];
  progressPercent?: number;
}

const STEPS = [
  {
    key: 'PROJECTS' as WorkflowStep,
    stepNum: 1,
    label: 'Curriculum Project',
    sublabel: 'Define Course',
    href: '/projects',
    icon: BookOpen,
  },
  {
    key: 'DOSSIER' as WorkflowStep,
    stepNum: 2,
    label: 'Course Dossier',
    sublabel: 'Ingest Specs',
    href: '/dossier',
    icon: FolderArchive,
  },
  {
    key: 'STUDIO' as WorkflowStep,
    stepNum: 3,
    label: 'Studio Dashboard',
    sublabel: 'Synthesize & Generate',
    href: '/',
    icon: Layers,
  },
];

export function WorkflowProgressBar({
  currentStep,
  projectId,
  projectName,
  completedSteps = [],
}: Props) {
  const currentIdx = STEPS.findIndex((s) => s.key === currentStep);

  return (
    <div className="w-full bg-white dark:bg-[#001530]/90 border border-slate-200 dark:border-white/10 rounded-3xl p-6 sm:p-8 shadow-sm dark:shadow-xl backdrop-blur-xl mb-6">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
        <div>
          <h2 className="text-lg font-display font-extrabold text-slate-900 dark:text-white tracking-wide uppercase">
            Curriculum Lifecycle Workflow
          </h2>
          {projectName ? (
             <p className="text-sm text-slate-500 dark:text-white/60 mt-1">
               Active Course: <span className="font-semibold text-slate-800 dark:text-slate-200">{projectName}</span>
             </p>
          ) : (
            <p className="text-sm text-slate-500 dark:text-white/60 mt-1">
              Complete each step sequentially to launch your course
            </p>
          )}
        </div>
        
        <div className="px-3 py-1.5 bg-slate-100 dark:bg-white/10 rounded-full">
           <span className="text-xs font-mono font-bold text-slate-600 dark:text-white/70">
             Step {currentIdx + 1} of {STEPS.length}
           </span>
        </div>
      </div>

      <div className="relative">
        {/* Background Connecting Line */}
        <div className="absolute top-6 left-[16.66%] right-[16.66%] h-1 bg-slate-100 dark:bg-white/10 rounded-full -z-10 transform -translate-y-1/2" />
        
        {/* Dynamic Progress Line */}
        <div 
          className="absolute top-6 left-[16.66%] h-1 bg-brand-gold dark:bg-gold-500 rounded-full transition-all duration-500 ease-in-out -z-10 transform -translate-y-1/2"
          style={{ width: `calc(${currentIdx / (STEPS.length - 1)} * 66.66%)` }}
        />

        <div className="flex justify-between items-start">
          {STEPS.map((step, idx) => {
            const isActive = step.key === currentStep;
            const isDone = completedSteps.includes(step.key) || idx < currentIdx;
            const Icon = step.icon;
            const targetHref = projectId ? `${step.href}?projectId=${projectId}` : step.href;

            return (
              <Link
                key={step.key}
                href={targetHref}
                className="group flex flex-col items-center w-1/3 text-center relative focus:outline-none"
              >
                {/* Step Circle */}
                <div 
                  className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center border-4 transition-all duration-300 shadow-sm relative z-10",
                    isActive 
                      ? "bg-brand-gold dark:bg-gold-500 border-white dark:border-[#001530] text-white dark:text-brand-navy scale-110 shadow-glow-gold" 
                      : isDone
                      ? "bg-brand-gold dark:bg-gold-500 border-white dark:border-[#001530] text-white dark:text-brand-navy"
                      : "bg-slate-100 border-white dark:border-[#001530] text-slate-400 dark:bg-slate-800/80 dark:text-slate-500 group-hover:bg-slate-200 dark:group-hover:bg-slate-700"
                  )}
                >
                  {isDone && !isActive ? (
                    <Check className="w-5 h-5 stroke-[3]" />
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}
                </div>

                {/* Labels */}
                <div className={cn("mt-4 px-1", isActive && "mt-5")}>
                  <p className={cn(
                    "text-sm font-display font-bold transition-colors leading-tight",
                    isActive ? "text-brand-navy dark:text-white" :
                    isDone ? "text-slate-800 dark:text-slate-200" :
                    "text-slate-500 dark:text-slate-400"
                  )}>
                    {step.stepNum}. {step.label}
                  </p>
                  <p className="text-[11px] mt-1 text-slate-400 dark:text-white/40 hidden sm:block">
                    {step.sublabel}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
