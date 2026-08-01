export type NewsViewItem = {
  id: string;
  href: string;
  title: string;
  summary: string;
  category: string;
  date: string;
  year?: number;
  image?: { src: string; alt: string };
};

export type NewsFilterCategory = { id: string; name: string };
