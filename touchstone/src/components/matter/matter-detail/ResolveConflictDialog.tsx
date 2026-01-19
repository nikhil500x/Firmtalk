'use client'
import React from 'react'
import { useState } from 'react';
import { toast } from 'react-toastify';

const ResolveConflictDialog = ({
    conflictId,
    onResolve
}: {
    conflictId: number;
    onResolve: (conflictId: number, resolutionNotes?: string) => void;
}) => {
    const [showNotes, setShowNotes] = useState(false);
    const [resolutionNotes, setResolutionNotes] = useState('');
    const [isResolving, setIsResolving] = useState(false);

    const handleResolveClick = async () => {
        if (!showNotes) {
            setShowNotes(true);
            return;
        }

        if (!resolutionNotes.trim()) {
            // alert('Please provide resolution notes');
            toast.error('Please provide resolution notes');
            return;
        }

        setIsResolving(true);
        await onResolve(conflictId, resolutionNotes);
        setIsResolving(false);
    };

    return (
        <div className="mt-4 space-y-3">
            {showNotes && (
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Resolution Notes <span className="text-red-500">*</span>
                    </label>
                    <textarea
                        value={resolutionNotes}
                        onChange={(e) => setResolutionNotes(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                        rows={4}
                        placeholder="Explain how this conflict was resolved..."
                    />
                </div>
            )}

            <div className="flex gap-3">
                <button
                    onClick={handleResolveClick}
                    disabled={isResolving}
                    className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-6 py-3 rounded-lg font-semibold transition-colors shadow-sm hover:shadow-md"
                >
                    {isResolving ? 'Resolving...' : showNotes ? 'Confirm Resolution' : 'Resolve Now'}
                </button>

                {showNotes && (
                    <button
                        onClick={() => {
                            setShowNotes(false);
                            setResolutionNotes('');
                        }}
                        className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
                    >
                        Cancel
                    </button>
                )}
            </div>
        </div>
    );
};

export default ResolveConflictDialog