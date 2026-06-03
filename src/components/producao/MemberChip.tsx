import { User as UserIcon } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export function MemberChip({
  active,
  onClick,
  label,
  count,
  avatar,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
  avatar?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "shrink-0 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-all",
        active
          ? "bg-primary text-primary-foreground border-primary shadow-soft"
          : "bg-background hover:bg-muted border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {avatar ? (
        <Avatar className="h-5 w-5">
          <AvatarFallback className="text-[10px]">{avatar}</AvatarFallback>
        </Avatar>
      ) : (
        <UserIcon className="h-3.5 w-3.5" />
      )}
      <span className="font-medium">{label}</span>
      {count !== undefined && (
        <span
          className={cn(
            "rounded-full px-1.5 text-[10px] font-bold",
            active ? "bg-primary-foreground/20" : "bg-muted",
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}
