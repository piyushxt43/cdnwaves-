export const Logo = (props: React.SVGProps<SVGSVGElement>) => {
  return (
    <svg
      viewBox="0 0 120 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <text
        x="10"
        y="28"
        fontFamily="var(--font-geist-mono), monospace"
        fontSize="20"
        fontWeight="700"
        fill="currentColor"
        className="text-foreground"
        letterSpacing="2"
      >
        PIYUSH SINGH
      </text>
    </svg>
  );
};
