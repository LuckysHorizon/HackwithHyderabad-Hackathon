"use client";

import { motion } from "framer-motion";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function Partners() {
  const stack = [
    { name: "Hindsight", role: "Agent memory (vectorize.io)" },
    { name: "Groq", role: "Fast LLM inference" },
    { name: "FastAPI", role: "API + WebSocket backend" },
    { name: "React", role: "Live dashboard UI" },
    { name: "Python", role: "Backend runtime" },
    { name: "Chart.js", role: "Realtime visualizations" },
  ];

  return (
    <section className="max-w-(--breakpoint-md) w-full mx-auto px-4 py-24 gap-10 md:px-8 flex flex-col justify-center items-center text-center">
      <motion.div
        initial={{ y: 20, opacity: 0, filter: "blur(3px)" }}
        whileInView={{
          y: 0,
          opacity: 1,
          filter: "blur(0px)",
        }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, type: "spring", bounce: 0 }}
        className="flex flex-col gap-3"
      >
        <h2 className="text-xl font-semibold sm:text-2xl bg-linear-to-b from-foreground to-muted-foreground text-transparent bg-clip-text">
          Built on a modern agent stack
        </h2>
      </motion.div>
      <div className="w-full grid grid-cols-3 sm:grid-cols-6 grid-rows-2 sm:grid-rows-1 gap-5 place-items-center">
        <TooltipProvider>
          {stack.map((item, index) => (
            <Tooltip key={item.name}>
              <TooltipTrigger asChild>
                <div className="shrink-0">
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    whileInView={{
                      y: 0,
                      opacity: 1,
                    }}
                    viewport={{ once: true }}
                    transition={{
                      duration: 1,
                      delay: index * 0.1,
                      type: "spring",
                      bounce: 0,
                    }}
                    className="text-lg sm:text-xl font-semibold tracking-tight text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {item.name}
                  </motion.div>
                </div>
              </TooltipTrigger>
              <TooltipContent>{item.role}</TooltipContent>
            </Tooltip>
          ))}
        </TooltipProvider>
      </div>
    </section>
  );
}
