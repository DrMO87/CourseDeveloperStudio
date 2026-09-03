'use client';

import React, { useState } from 'react';
import { Smile, Plus, Trash2, Image } from 'lucide-react';
import type { MascotConfig, MascotPose } from '@/lib/types';

interface Props {
  mascot: MascotConfig;
  onChange: (updated: MascotConfig) => void;
}

export function MascotConfigEditor({ mascot, onChange }: Props) {
  const [poseName, setPoseName] = useState('');
  const [assetFile, setAssetFile] = useState('');
  const [slideContext, setSlideContext] = useState('title_slide');

  const addPose = () => {
    if (!poseName.trim() || !assetFile.trim()) return;
    const newPose: MascotPose = {
      pose_name: poseName.trim().toLowerCase(),
      asset_file: assetFile.trim(),
      slide_context: slideContext
    };
    onChange({
      ...mascot,
      poses: [...mascot.poses, newPose]
    });
    setPoseName('');
    setAssetFile('');
  };

  const removePose = (index: number) => {
    const updatedPoses = [...mascot.poses];
    updatedPoses.splice(index, 1);
    onChange({
      ...mascot,
      poses: updatedPoses
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
          <Smile className="w-5 h-5 text-amber-400" />
          Mascot & Character Persona Rules
        </h3>
        <p className="text-xs text-slate-400 mt-1">
          Optionally configure an institution mascot character (e.g. Tata, Nova, Leo) and map specific visual poses to pedagogical slide stages (e.g. Welcoming, Cognitive Challenge, Celebration).
        </p>
      </div>

      <div className="bg-slate-900/60 p-5 rounded-xl border border-slate-800 space-y-5">
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Character / Mascot Name
          </label>
          <input
            type="text"
            placeholder="e.g. Tata, Robi, Spark"
            value={mascot.character_name || ''}
            onChange={(e) => onChange({ ...mascot, character_name: e.target.value || null })}
            className="w-full max-w-sm bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-400"
          />
        </div>

        {/* Poses List */}
        <div className="space-y-3 pt-3 border-t border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Image className="w-4 h-4 text-amber-400" />
              Configured Character Poses & Contexts ({mascot.poses.length})
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {mascot.poses.map((pose, idx) => (
              <div
                key={idx}
                className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-1.5 relative group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-wide">
                    {pose.pose_name}
                  </span>
                  <button
                    type="button"
                    onClick={() => removePose(idx)}
                    className="text-slate-500 hover:text-rose-400 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="text-xs font-mono text-slate-300 truncate">
                  📁 {pose.asset_file}
                </div>
                <div className="text-[11px] text-slate-400">
                  Target: <span className="text-slate-200">{pose.slide_context}</span>
                </div>
              </div>
            ))}
            {mascot.poses.length === 0 && (
              <div className="col-span-full py-4 text-center text-xs text-slate-500 italic">
                No character poses configured.
              </div>
            )}
          </div>

          {/* Add Pose Form */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2">
            <input
              type="text"
              placeholder="Pose (e.g. thinking)"
              value={poseName}
              onChange={(e) => setPoseName(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
            />
            <input
              type="text"
              placeholder="Asset (e.g. tata_thinking.png)"
              value={assetFile}
              onChange={(e) => setAssetFile(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
            />
            <div className="flex gap-2">
              <select
                value={slideContext}
                onChange={(e) => setSlideContext(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
              >
                <option value="title_slide">Title / Intro Slide</option>
                <option value="challenge_slide">Cognitive Challenge</option>
                <option value="closing_slide">Mastery / Closing</option>
                <option value="procedural_slide">Hardware Steps</option>
              </select>
              <button
                type="button"
                onClick={addPose}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                Add
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
