"use client";

import Link from "next/link";

import { LogOut, Menu, User } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface HeaderProps {
  title: string;
  subtitle?: string;
  userName?: string;
  onMenuToggle?: () => void;
  onSignOut?: () => void;
  showMenuButton?: boolean;
  societySwitcher?: React.ReactNode;
  searchBar?: React.ReactNode;
}

export function Header({
  title,
  subtitle,
  userName = "User",
  onMenuToggle,
  onSignOut,
  showMenuButton,
  societySwitcher,
  searchBar,
}: HeaderProps) {
  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <header className="bg-background border-b px-4 py-3 lg:px-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {showMenuButton && (
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenuToggle}>
              <Menu className="h-5 w-5" />
            </Button>
          )}
          <div>
            {societySwitcher ?? (
              <>
                <h1 className="text-lg font-semibold">{title}</h1>
                {subtitle && <p className="text-muted-foreground text-sm">{subtitle}</p>}
              </>
            )}
          </div>
        </div>
        {searchBar && <div className="mx-4 hidden flex-1 md:block">{searchBar}</div>}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-9 w-9 rounded-full">
              <Avatar className="h-9 w-9">
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href="/admin/profile">
                <User className="mr-2 h-4 w-4" />
                Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
