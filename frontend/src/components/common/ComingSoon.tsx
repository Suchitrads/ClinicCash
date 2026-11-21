import type { FC } from 'react';

export interface ComingSoonProps {
  title: string;
}

export const ComingSoon: FC<ComingSoonProps> = ({ title }) => {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16">
      <h1 className="text-2xl font-semibold text-text">{title}</h1>
      <p className="mt-2 text-muted">This module is next in the build sequence.</p>
    </div>
  );
};

export default ComingSoon;
