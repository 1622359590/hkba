export default function NewsLoadingSkeleton({ label }: { label: string }) {
  return <div className="news-skeleton" role="status" aria-label={label}><div className="news-skeleton__main" aria-hidden="true" /><div className="news-skeleton__side" aria-hidden="true"><i /><i /></div><div className="news-skeleton__rows" aria-hidden="true">{Array.from({ length: 4 }, (_, index) => <i key={index} />)}</div></div>;
}
