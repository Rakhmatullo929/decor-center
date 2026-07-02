import { TableSkeleton } from 'src/components/table';

type Props = {
  rows?: number;
};

export function SpecialtiesTableSkeleton({ rows = 6 }: Props) {
  return (
    <>
      {Array.from({ length: rows }, (_, index) => (
        <TableSkeleton key={index} />
      ))}
    </>
  );
}
