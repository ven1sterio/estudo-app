export default function Skeleton({ className = "", ...props }) {
  return (
    <div
      className={"animate-pulse rounded-xl skeleton " + className}
      {...props}
    />
  );
}
