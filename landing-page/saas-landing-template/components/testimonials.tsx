"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Button } from "./ui/button";

const decisionStyles: Record<string, { label: string; className: string }> = {
  block: {
    label: "Blocked",
    className: "bg-destructive/10 text-destructive border-destructive/20",
  },
  verify: {
    label: "Verify",
    className:
      "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20",
  },
  sandbox: {
    label: "Sandboxed",
    className:
      "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
  },
};

export default function Testimonials() {
  const [showAll, setShowAll] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const visibleCount = isMobile ? 4 : 6;

  const attacks = [
    {
      tactic: "Ignore previous instructions",
      category: "Prompt injection",
      decision: "block",
      content:
        "A direct override telling the agent to drop its system prompt and follow new orders. Caught once, now blocked on the first token.",
    },
    {
      tactic: "Translate-and-execute",
      category: "Prompt injection",
      decision: "block",
      content:
        "Hides a malicious instruction inside a translation request so it slips past keyword filters. Antibody remembers the shape, not the words.",
    },
    {
      tactic: "Grandma jailbreak",
      category: "Roleplay jailbreak",
      decision: "sandbox",
      content:
        "Emotional roleplay that coaxes the agent into revealing restricted content. Routed to a sandboxed response instead of a refusal.",
    },
    {
      tactic: "Refund social engineering",
      category: "Social engineering",
      decision: "verify",
      content:
        "Impersonates staff to pressure the agent into issuing a refund. Escalated to identity verification before any action.",
    },
    {
      tactic: "Base64 payload",
      category: "Obfuscation",
      decision: "block",
      content:
        "Encodes the injection so plain-text filters miss it. Recognized from a prior encounter and blocked before decoding.",
    },
    {
      tactic: "Exfiltration via summary",
      category: "Data exfiltration",
      decision: "block",
      content:
        "Asks the agent to “summarize everything above,” hoping to leak hidden system context. Denied on recall.",
    },
    {
      tactic: "Slow-drip probing",
      category: "Reconnaissance",
      decision: "verify",
      content:
        "Benign-looking questions across many turns that quietly map the guardrails. The identity graph links them into one campaign.",
    },
    {
      tactic: "Forged tool output",
      category: "Prompt injection",
      decision: "sandbox",
      content:
        "Injects fake tool results to redirect the agent mid-task. Contained in a sandbox until the source is confirmed.",
    },
    {
      tactic: "Unicode homoglyphs",
      category: "Obfuscation",
      decision: "block",
      content:
        "Swaps look-alike characters to dodge keyword blocks. The sanitized pattern already lives in the antigen bank.",
    },
    {
      tactic: "Authority spoofing",
      category: "Social engineering",
      decision: "verify",
      content:
        "Claims to be an admin or developer to unlock privileged actions. Held for verification, never auto-approved.",
    },
  ];

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const updateIsMobile = () => setIsMobile(mediaQuery.matches);

    updateIsMobile();
    mediaQuery.addEventListener("change", updateIsMobile);

    return () => {
      mediaQuery.removeEventListener("change", updateIsMobile);
    };
  }, []);

  return (
    <section id="attacks" className="px-3 py-16 sm:px-4 sm:py-24">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="mb-12 flex flex-col gap-3 text-center sm:mb-20"
        >
          <h2 className="text-xl font-semibold sm:text-2xl bg-linear-to-b from-foreground to-muted-foreground text-transparent bg-clip-text">
            Attacks it has already seen
          </h2>
          <p className="mx-auto max-w-xl text-muted-foreground text-center">
            Every pattern below was caught once, remembered, and is now handled
            the moment it reappears.
          </p>
        </motion.div>
        <div className="relative">
          <div className="columns-2 gap-3 space-y-3 sm:gap-8 sm:space-y-8 md:columns-2 lg:columns-3">
            {(showAll ? attacks : attacks.slice(0, visibleCount)).map(
              (attack, index) => {
                const style =
                  decisionStyles[attack.decision] ?? decisionStyles.block;
                return (
                  <motion.div
                    key={index}
                    initial={{ y: 20, opacity: 0 }}
                    whileInView={{ y: 0, opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{
                      duration: 0.6,
                      delay: index * 0.05,
                      ease: "easeOut",
                    }}
                    className="mb-3 break-inside-avoid sm:mb-8"
                  >
                    <div className="rounded-lg border border-border bg-card p-3 transition-colors duration-300 sm:rounded-xl sm:p-6">
                      <div className="mb-3 flex items-center gap-2 sm:mb-4">
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold sm:text-xs ${style.className}`}
                        >
                          {style.label}
                        </span>
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground sm:text-xs">
                          {attack.category}
                        </span>
                      </div>

                      <p className="mb-4 text-xs leading-snug text-muted-foreground sm:mb-6 sm:text-sm sm:leading-relaxed">
                        {attack.content}
                      </p>

                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-primary/20 bg-linear-to-br from-primary/20 to-primary/10 font-mono text-xs sm:h-10 sm:w-10 sm:text-sm">
                          {"</>"}
                        </div>
                        <div className="min-w-0">
                          <h4 className="truncate text-xs font-semibold sm:text-sm">
                            {attack.tactic}
                          </h4>
                          <p className="truncate text-[10px] leading-tight text-muted-foreground sm:text-xs">
                            Stored in the antigen bank
                          </p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              },
            )}
          </div>

          {!showAll && attacks.length > visibleCount && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-linear-to-t from-background via-background/90 to-transparent" />
          )}
        </div>

        {!showAll && attacks.length > visibleCount && (
          <div className="mt-4 flex justify-center">
            <Button variant="ghost" onClick={() => setShowAll(true)}>
              Show more
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
