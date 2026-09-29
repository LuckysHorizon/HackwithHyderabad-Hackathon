"use client";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRightIcon } from "@radix-ui/react-icons";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:8000/";

const Footer = () => {
  const year = new Date().getFullYear();

  const footerLinks = [
    { name: "Attacks", href: "#attacks" },
    { name: "Metrics", href: "#metrics" },
    { name: "Deploy", href: "#pricing" },
    { name: "FAQ", href: "#faq" },
  ];

  return (
    <footer className="w-full border-t bg-card/50">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="space-y-8"
        >
          <div className="grid gap-8 sm:grid-cols-2 sm:gap-10 lg:grid-cols-3">
            <div className="space-y-3">
              <Link
                href="/"
                className="inline-block text-xl font-semibold tracking-tight transition-opacity hover:opacity-80"
              >
                Antibody
              </Link>
              <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
                An immune-memory layer for customer-facing AI agents. It
                remembers every attack it sees and blocks the next one before it
                lands.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Explore</h3>
              <div className="flex flex-col gap-2">
                {footerLinks.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {item.name}
                  </Link>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Get started</h3>
              <p className="max-w-xs text-sm text-muted-foreground">
                Open the live dashboard and watch decisions stream in.
              </p>
              <Button asChild size="sm">
                <a href={APP_URL}>
                  Try here
                  <ArrowRightIcon className="ml-1 size-4" />
                </a>
              </Button>
            </div>
          </div>

          <Separator />

          <div className="flex flex-col items-center justify-between gap-2 text-center text-sm text-muted-foreground sm:flex-row sm:text-left">
            <span>© {year} Antibody. All rights reserved.</span>
            <span className="font-medium">Immune memory for AI agents.</span>
          </div>
        </motion.div>
      </div>
    </footer>
  );
};

export default Footer;
