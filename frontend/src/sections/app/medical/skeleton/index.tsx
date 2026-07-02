import { TableSkeleton } from 'src/components/table';

type Props = {
  rows?: number;
};

export function MedicalTableSkeleton({ rows = 8 }: Props) {
  return (
    <>
      {Array.from({ length: rows }, (_, index) => (
        <TableSkeleton key={index} />
      ))}
    </>
  );
}
