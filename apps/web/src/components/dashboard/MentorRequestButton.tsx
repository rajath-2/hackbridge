import * as React from "react"
import { Button } from "../ui/button"
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export interface MentorRequestButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  teamId: string;
}

export function MentorRequestButton({ teamId, className, ...props }: MentorRequestButtonProps) {
  const [status] = React.useState<'idle' | 'loading' | 'sent' | 'cooldown'>('idle');
  const [timeLeft] = React.useState(0);

  // Note: Actual implementation would fetch from /teams/{teamId}/mentor-request-cooldown
  // and POST to /teams/{teamId}/mentor-request. Mocked for UI purposes.

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <Button 
      variant="mentor-request"
      disabled={status !== 'idle'}
      className={cn(status === 'cooldown' || status === 'sent' ? 'opacity-60 cursor-not-allowed' : '', className)}
      {...props}
    >
      {status === 'idle' && "Request help"}
      {status === 'loading' && "Requesting..."}
      {status === 'sent' && "Mentor notified"}
      {status === 'cooldown' && `Request help (${formatTime(timeLeft)})`}
    </Button>
  )
}
