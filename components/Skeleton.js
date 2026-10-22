export default function Skeleton({ className = "", ...props }) {
  return (
    <div
      className={"animate-pulse rounded-xl bg-borderSoft/60 " + className}
      {...props}
    />
  );
}