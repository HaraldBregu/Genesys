export type ContinueDecision =
  | { continue: false }
  | { continue: true; nextPrompt: string };

export type ContinueStrategy = (ctx: {
  prompt: string;
  depth: number;
}) => ContinueDecision | Promise<ContinueDecision>;

export const neverContinue: ContinueStrategy = () => ({ continue: false });

export const randomContinue: ContinueStrategy = ({ prompt }) =>
  Math.random() < 0.8
    ? { continue: true, nextPrompt: prompt }
    : { continue: false };
