"use client";
/* eslint-disable @next/next/no-img-element */
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { motion } from "framer-motion";
import { ArrowRightIcon } from "@radix-ui/react-icons";

const APP_URL = "http://localhost:8000/";

export default function Hero() {
  return (
    <div className="relative justify-center items-center">
      <section className="max-w-(--breakpoint-xl) mx-auto px-4 py-28 gap-12 md:px-8 flex flex-col justify-center items-center">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{
            y: 0,
            opacity: 1,
          }}
          transition={{ duration: 0.6, type: "spring", bounce: 0 }}
          className="flex flex-col justify-center items-center space-y-5 max-w-4xl mx-auto text-center"
        >
          <span className="w-fit h-full text-sm bg-card px-2 py-1 border border-border rounded-full">
            Built on Hindsight agent memory
          </span>
          <h1 className="text-4xl font-medium tracking-tighter mx-auto md:text-6xl text-pretty bg-linear-to-b from-sky-800 dark:from-sky-100 to-foreground dark:to-foreground bg-clip-text text-transparent">
            Give your AI agents an immune system
          </h1>
          <p className="max-w-2xl text-lg mx-auto text-muted-foreground text-balance">
            Antibody sits in front of your customer-facing agents. It remembers
            every jailbreak, prompt injection, and abuse pattern it sees — so
            the next attack is blocked before it ever lands.
          </p>
          <motion.div
            className="items-center justify-center gap-x-3 space-y-3 sm:flex sm:space-y-0"
          >
            <motion.div whileHover={{ scale: 1.05 }} className="inline-block">
              <Button asChild className="shadow-lg">
                <a href={APP_URL}>
                  Try here
                  <ArrowRightIcon className="ml-1" />
                </a>
              </Button>
            </motion.div>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">How it works</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>How Antibody works</DialogTitle>
                  <DialogDescription>
                    Every request flows through three steps. Recall — before the
                    agent replies, Antibody pulls up past attacks from similar
                    users and contexts. Retain — each sanitized interaction is
                    stored in a per-tenant antigen bank. Reflect — offline, a
                    Dream Cycle synthesizes new attack patterns from what it has
                    seen. The result: allow, verify, sandbox, or block.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button asChild size="sm">
                    <a href={APP_URL}>
                      Open the live dashboard
                      <ArrowRightIcon className="ml-1" />
                    </a>
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </motion.div>
        </motion.div>
      </section>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 2, delay: 0.5, type: "spring", bounce: 0 }}
        className="w-full h-full absolute -top-32 flex justify-end items-center pointer-events-none "
      >
        <div className="w-3/4 flex justify-center items-center">
          <div className="w-12 h-150 bg-light blur-[70px] rounded-3xl max-sm:rotate-15 sm:rotate-35 will-change-transform"></div>
        </div>
      </motion.div>
    </div>
  );
}
