'use client';

// Minimal replacement for @lobehub/ui's CopyButton.

import { useState } from 'react';

export function CopyButton({ content }: { content: string }) {
    const [copied, setCopied] = useState(false);

    return (
        <button
            className='cursor-pointer text-xs opacity-60 hover:opacity-100'
            title='Copy'
            onClick={async () => {
                await navigator.clipboard.writeText(content);
                setCopied(true);
                setTimeout(() => setCopied(false), 1_200);
            }}
        >
            {copied ? '✓' : '⧉'}
        </button>
    );
}
