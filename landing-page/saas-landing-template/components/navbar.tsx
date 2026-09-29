"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ThemeSwitcher from "@/components/theme-switcher";
import {
  ChevronDownIcon,
  MagnifyingGlassIcon,
  ArchiveIcon,
  MoonIcon,
  LightningBoltIcon,
  Share1Icon,
  ArrowRightIcon,
  HamburgerMenuIcon,
  Cross1Icon,
} from "@radix-ui/react-icons";
import Link from "next/link";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:8000/";

export default function NavBar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 0);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const menuItems = [
    { name: "Attacks", href: "#attacks" },
    { name: "Metrics", href: "#metrics" },
    { name: "Deploy", href: "#pricing" },
    { name: "FAQ", href: "#faq" },
  ];

  const capabilities = [
    {
      icon: MagnifyingGlassIcon,
      title: "Recall",
      desc: "Before the agent replies, Antibody pulls up past attacks from similar users and contexts.",
    },
    {
      icon: ArchiveIcon,
      title: "Retain",
      desc: "Every sanitized interaction is stored in a per-tenant antigen bank for next time.",
    },
    {
      icon: MoonIcon,
      title: "Dream Cycle",
      desc: "Offline, Antibody reflects on stored traffic to synthesize brand-new attack patterns.",
    },
    {
      icon: LightningBoltIcon,
      title: "Decisions",
      desc: "Allow, verify, sandbox, or block — every request gets a graded, sourced response.",
    },
    {
      icon: Share1Icon,
      title: "Identity graph",
      desc: "See how attackers, sessions, and tactics connect across your tenant.",
    },
  ];

  const showNavbarBlur = isScrolled || isMenuOpen;

  return (
    <nav
      className={`sticky top-0 z-50 w-full transition-[background-color,backdrop-filter] duration-300 ease-out ${
        showNavbarBlur
          ? "backdrop-blur supports-backdrop-filter:bg-background/60"
          : "backdrop-blur-0 supports-backdrop-filter:bg-background/0"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex sm:hidden">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="relative"
            >
              <motion.div
                animate={{ rotate: isMenuOpen ? 90 : 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
              >
                {isMenuOpen ? <Cross1Icon /> : <HamburgerMenuIcon />}
              </motion.div>
            </Button>
          </div>
          <div className="flex sm:hidden">
            <Link href="/" className="font-semibold tracking-tight text-lg">
              Antibody
            </Link>
          </div>
          <div className="hidden sm:flex items-center space-x-8">
            <Link href="/" className="font-semibold tracking-tight text-2xl">
              Antibody
            </Link>

            <Button asChild variant="ghost" size="sm">
              <Link href="#attacks">Attacks</Link>
            </Button>

            <Button asChild variant="ghost" size="sm">
              <Link href="#metrics">Metrics</Link>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  Capabilities
                  <ChevronDownIcon className="ml-1 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-80">
                {capabilities.map((cap) => (
                  <DropdownMenuItem key={cap.title}>
                    <cap.icon className="mr-2 h-4 w-4" />
                    <div>
                      <div className="font-semibold">{cap.title}</div>
                      <div className="text-sm text-muted-foreground">
                        {cap.desc}
                      </div>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="flex items-center space-x-4">
            <Button asChild className="hidden sm:flex" size="sm">
              <a href={APP_URL}>
                Try here
                <ArrowRightIcon className="ml-1 size-4" />
              </a>
            </Button>
            <ThemeSwitcher />
          </div>
        </div>
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="sm:hidden overflow-hidden"
            >
              <motion.div
                initial={{ y: -20 }}
                animate={{ y: 0 }}
                exit={{ y: -20 }}
                transition={{ duration: 0.3, delay: 0.1 }}
                className="px-2 pt-2 pb-3 space-y-1"
              >
                {menuItems.map((item, index) => (
                  <motion.div
                    key={item.name}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: 0.2 + index * 0.1 }}
                  >
                    <Link
                      href={item.href}
                      className="block px-3 py-2 text-base font-medium text-foreground hover:bg-muted rounded-md transition-colors duration-200"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      {item.name}
                    </Link>
                  </motion.div>
                ))}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: 0.6 }}
                >
                  <a
                    href={APP_URL}
                    className="flex items-center gap-1 whitespace-nowrap px-3 py-2 text-base font-medium text-primary hover:bg-muted rounded-md transition-colors duration-200"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <span>Try here</span>
                    <ArrowRightIcon className="size-4" />
                  </a>
                </motion.div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </nav>
  );
}
