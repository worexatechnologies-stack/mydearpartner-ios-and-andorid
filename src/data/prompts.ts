/**
 * MyDearPartner — Hinge-style Conversation Prompts
 * Users pick up to 3 and write answers to show on their profile.
 */

export const PROFILE_PROMPTS: string[] = [
  'A perfect Sunday looks like…',
  'My love language is…',
  'The way to my heart is…',
  'I am looking for someone who…',
  "A fact most people don't know about me…",
  'I take pride in…',
  'My biggest green flag is…',
  'My family taught me…',
  "I'm convinced that…",
  'Two truths and a lie…',
  'My ideal first date…',
  'I geek out about…',
  'A life goal of mine is…',
  'The key to my heart is…',
  "I'm most passionate about…",
  'My friends describe me as…',
  "I'm happiest when…",
  "The best thing I've ever cooked is…",
  'If I could live anywhere, it would be…',
  'Something I want to do before I settle down…',
  'My go-to comfort food is…',
  'What makes me laugh without fail…',
  'I want someone who will…',
];

export interface ProfilePrompt {
  question: string;
  answer: string;
}
