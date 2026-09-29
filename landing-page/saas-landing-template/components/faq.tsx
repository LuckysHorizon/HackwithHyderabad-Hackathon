"use client";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { motion } from "framer-motion";

export default function Faq() {
  const accordionItems = [
    {
      title: "What is Antibody?",
      content: (
        <div className="text-muted-foreground">
          Antibody is a memory layer that sits in front of your customer-facing
          AI agents. It watches every conversation, learns the attacks it sees,
          and handles them the next time they appear.
        </div>
      ),
    },
    {
      title: "How does it learn new attacks?",
      content: (
        <div className="text-muted-foreground">
          Three steps. It <strong>recalls</strong> similar past interactions
          before the agent replies, <strong>retains</strong> every sanitized
          interaction in a per-tenant antigen bank, and <strong>reflects</strong>{" "}
          offline in a Dream Cycle to synthesize brand-new attack patterns from
          what it has stored.
        </div>
      ),
    },
    {
      title: "Will it slow down my agent?",
      content: (
        <div className="text-muted-foreground">
          Recall runs in tens of milliseconds against a vector store, so the
          guardrail check adds negligible latency before your agent responds.
        </div>
      ),
    },
    {
      title: "How is user data handled?",
      content: (
        <div className="text-muted-foreground">
          Identifiers like phone numbers and emails are hashed with a salt
          before storage, and only the last two digits are ever shown. A
          sanitizer strips identifiers before anything is written to the antigen
          bank, and every recall is filtered by tenant.
        </div>
      ),
    },
    {
      title: "What is it built on?",
      content: (
        <div className="text-muted-foreground">
          Hindsight for agent memory, Groq for fast LLM inference, and a FastAPI
          backend that streams decisions to a React dashboard over WebSocket.
        </div>
      ),
    },
  ];

  return (
    <motion.section
      id="faq"
      initial={{ y: 20, opacity: 0 }}
      whileInView={{
        y: 0,
        opacity: 1,
      }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: 0.5, type: "spring", bounce: 0 }}
      className="relative w-full max-w-(--breakpoint-xl) mx-auto px-4 py-28 gap-5 md:px-8 flex flex-col justify-center items-center"
    >
      <div className="flex flex-col gap-3 justify-center items-center">
        <h4 className="text-2xl font-bold sm:text-3xl bg-linear-to-b from-foreground to-muted-foreground text-transparent bg-clip-text">
          FAQ
        </h4>
        <p className="max-w-xl text-muted-foreground text-center">
          Here are some of our frequently asked questions.
        </p>
      </div>
      <div className="flex w-full max-w-lg">
        <Accordion type="multiple" className="w-full">
          {accordionItems.map((item, index) => (
            <AccordionItem
              key={index}
              value={`item-${index}`}
              className="text-muted-foreground"
            >
              <AccordionTrigger className="text-left">
                {item.title}
              </AccordionTrigger>
              <AccordionContent>{item.content}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </motion.section>
  );
}
