export type PublicPageIntro = 'leadership' | null;

type PageBlockLike = {
  component_type: string;
};

export function resolvePublicPagePresentation<T extends PageBlockLike>(path: string, blocks: T[]): {
  intro: PublicPageIntro;
  blocks: T[];
} {
  if (path !== '/members') return { intro: null, blocks };

  const startsWithGenericHero = blocks[0]?.component_type === 'content.hero';
  return {
    intro: 'leadership',
    blocks: startsWithGenericHero ? blocks.slice(1) : blocks,
  };
}
