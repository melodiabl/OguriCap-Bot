'use client';

import React from 'react';
import { Terminal as TerminalIcon } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Reveal } from '@/components/motion/Reveal';
import { TerminalLogViewer } from '@/components/logs/TerminalLogViewer';

export default function LogsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Terminal"
        description="Salida en vivo del servidor (stdout/stderr)"
        icon={<TerminalIcon className="h-7 w-7 text-primary-300" />}
      />

      <Reveal>
        <TerminalLogViewer />
      </Reveal>
    </div>
  );
}
