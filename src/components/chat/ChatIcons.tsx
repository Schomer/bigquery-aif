import * as React from "react";

export function HubIcon({
  size = 18,
  className,
  ...props
}: React.SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 18 18"
      fill="currentColor"
      className={className}
      {...props}
    >
      <path d="M4.519 17.25q-.957 0-1.622-.666-.666-.665-.666-1.622 0-.956.666-1.621.665-.666 1.622-.666.262 0 .478.056.216.056.422.15l1.012-1.256q-.487-.562-.702-1.294-.216-.73-.104-1.462L4.2 8.399q-.32.47-.816.751-.497.281-1.096.281-.957 0-1.622-.665Q0 8.1 0 7.144q0-.957.666-1.623.665-.665 1.622-.665.956 0 1.622.665.665.666.665 1.623v.131L6 7.762q.375-.656.994-1.124.618-.47 1.406-.619V4.5q-.731-.206-1.209-.815-.479-.61-.479-1.397 0-.957.666-1.622Q8.044 0 9 0q.956 0 1.622.666.666.665.666 1.622 0 .787-.488 1.387t-1.2.806V6.02q.788.15 1.406.618.62.47.994 1.125l1.425-.487v-.131q0-.957.665-1.623.666-.665 1.622-.665.957 0 1.622.665.666.667.666 1.623t-.666 1.622q-.665.665-1.622.665-.6 0-1.096-.28-.497-.282-.816-.751l-1.425.469q.113.75-.103 1.472t-.703 1.284l1.012 1.238q.206-.094.422-.141.216-.047.478-.047.957 0 1.622.666.666.665.666 1.622 0 .956-.666 1.621-.665.666-1.622.666-.956 0-1.622-.666-.665-.665-.665-1.621 0-.376.112-.722.113-.347.32-.628l-1.013-1.238q-.75.412-1.622.412-.872 0-1.622-.412l-.994 1.238q.206.281.32.628.11.346.11.722 0 .956-.664 1.621-.666.666-1.622.666zM2.288 7.856q.3 0 .506-.206Q3 7.444 3 7.144q0-.3-.206-.506-.207-.207-.506-.207-.3 0-.507.207-.206.206-.206.506 0 .3.206.506.206.206.507.206zm2.23 7.82q.3 0 .507-.207.206-.207.206-.506 0-.3-.206-.507-.206-.206-.506-.206-.3 0-.507.206-.206.207-.206.507 0 .3.206.506.207.206.507.206zM9 3q.3 0 .506-.206.207-.206.207-.506 0-.3-.207-.507Q9.3 1.575 9 1.575q-.3 0-.506.206-.207.206-.207.507 0 .3.207.506Q8.7 3 9 3zm0 8.212q.769 0 1.303-.533.535-.535.535-1.304 0-.77-.535-1.303Q9.77 7.538 9 7.538q-.769 0-1.303.534-.534.534-.535 1.303 0 .769.535 1.303.534.534 1.303.534zm4.481 4.463q.3 0 .507-.206.206-.207.206-.506 0-.3-.206-.507-.207-.206-.507-.206-.3 0-.506.206-.206.207-.206.507 0 .3.206.506.206.206.506.206zm2.231-7.819q.3 0 .507-.206.206-.206.206-.506 0-.3-.206-.507-.206-.206-.507-.206-.3 0-.506.206-.206.207-.206.507 0 .3.206.506.206.206.506.206zM9 2.288zM2.288 7.144zM9 9.375zm6.712-2.23zM4.52 14.962zm8.962 0z" />
    </svg>
  );
}

/** Context & template outline badge from the attached screenshot */
export function ContextBadgeIcon({
  size = 18,
  className,
  ...props
}: React.SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <path d="M12 3l6 4v9l-6 4-6-4V7l6-4z" />
    </svg>
  );
}

/** 4-corner brackets fullscreen icon in the top right */
export function FullscreenIcon({
  size = 18,
  className,
  ...props
}: React.SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
    </svg>
  );
}

/** 4-inward brackets icon to exit fullscreen / restore */
export function FullscreenExitIcon({
  size = 18,
  className,
  ...props
}: React.SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <path d="M4 9h5V4m6 0v5h5m-5 11v-5h5M4 15h5v5" />
    </svg>
  );
}


export function PlusIcon({
  size = 18,
  className,
  ...props
}: React.SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

export function SendIcon({
  size = 16,
  className,
  ...props
}: React.SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      {...props}
    >
      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
    </svg>
  );
}

export function TableIcon({
  size = 18,
  className,
  ...props
}: React.SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 18 18"
      fill="none"
      className={className}
      {...props}
    >
      <rect
        x="2"
        y="2"
        width="14"
        height="14"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <line x1="2" y1="7" x2="16" y2="7" stroke="currentColor" strokeWidth="1.4" />
      <line x1="2" y1="12" x2="16" y2="12" stroke="currentColor" strokeWidth="1.4" />
      <line x1="7" y1="7" x2="7" y2="16" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export function ChartIcon({
  size = 18,
  className,
  ...props
}: React.SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      fillRule="evenodd"
      className={className}
      {...props}
    >
      <path d="M7 11v1.922c.25.87 1.176 1.48 2 1.85V11z" opacity=".6" />
      <path d="M10 9v5.933c.34.04.688.067 1.045.067.326 0 .643-.023.955-.058V9z" />
      <path
        d="M13.007 12v2.7c.836-.373 1.618-.825 2-1.85V12zm7.883 7.072-3.19-3.188a.36.36 0 00-.304-.095 7.8 7.8 0 01-1.61 1.6.37.37 0 00.097.3l3.187 3.18a.38.38 0 00.537 0l1.28-1.28a.38.38 0 000-.54z"
        opacity=".6"
      />
      <path d="M11 3a8 8 0 100 16 8 8 0 000-16m0 14a6 6 0 110-12 6 6 0 010 12" />
    </svg>
  );
}

export function NotebookIcon({
  size = 18,
  className,
  ...props
}: React.SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 18 18"
      fill="none"
      className={className}
      {...props}
    >
      <rect
        x="3"
        y="2"
        width="12"
        height="14"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <line
        x1="6"
        y1="6"
        x2="12"
        y2="6"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <line
        x1="6"
        y1="9"
        x2="12"
        y2="9"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <line
        x1="6"
        y1="12"
        x2="10"
        y2="12"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function StorageIcon({
  size = 18,
  className,
  ...props
}: React.SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 15 12"
      fill="currentColor"
      className={className}
      {...props}
    >
      <path d="M13.5 6.75H0V12H15V6.75H13.5ZM7.5 9.75H3V9H7.5V9.75ZM10.87 10.5C10.646 10.5 10.427 10.434 10.241 10.309C10.055 10.184 9.91 10.007 9.825 9.8C9.74 9.593 9.718 9.365 9.763 9.146C9.807 8.926 9.916 8.725 10.075 8.567C10.234 8.41 10.436 8.303 10.656 8.261C10.876 8.218 11.103 8.242 11.309 8.329C11.516 8.416 11.692 8.562 11.814 8.75C11.937 8.937 12.002 9.156 12 9.38C11.997 9.678 11.877 9.963 11.666 10.173C11.454 10.382 11.168 10.5 10.87 10.5ZM14.25 0H0V5.25H15V0H14.25ZM7.5 3H3V2.25H7.5V3ZM10.87 3.75C10.646 3.75 10.427 3.683 10.241 3.559C10.055 3.434 9.91 3.257 9.825 3.05C9.74 2.843 9.718 2.615 9.763 2.396C9.807 2.176 9.916 1.975 10.075 1.817C10.234 1.66 10.436 1.553 10.656 1.511C10.876 1.468 11.103 1.492 11.309 1.579C11.516 1.666 11.692 1.812 11.814 2C11.937 2.187 12.002 2.406 12 2.63C11.997 2.928 11.877 3.213 11.666 3.423C11.454 3.632 11.168 3.75 10.87 3.75Z" />
    </svg>
  );
}
export function ThumbUpIcon({
  size = 16,
  className,
  ...props
}: React.SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
    </svg>
  );
}

export function ThumbDownIcon({
  size = 16,
  className,
  ...props
}: React.SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3" />
    </svg>
  );
}

export function ModelIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 -960 960 960"
      width="18"
      height="18"
      fill="currentColor"
      {...props}
    >
      <path d="M480-48q-50 0-85-35t-35-85q0-15.44 3.5-29.22T374-224L223-375q-13 7-26.65 10.5Q182.7-361 168-361q-50.42 0-85.21-35Q48-431 48-481t34.79-84.5Q117.58-600 168-600q41 0 72 23.5t41.65 60.5H366q9-28 29.5-48.5T444-594v-84.35Q407-689 383.5-720T360-792q0-50 35-85t85-35q50 0 84.5 35t34.5 85q0 14.7-3 28.35Q593-750 586-737l150 151q12.92-7 26.92-10.5 14-3.5 29.08-3.5 50 0 85 35t35 85q0 50-35 85t-85 35q-41 0-72-23.5T678.35-444H594q-9 28-29.5 48.5T516-366v83.36q37 10.64 60.5 42.14T600-168q0 50-35 85t-85 35Zm-56-227q2-1 4.5-2l5-2 5-2q2.5-1 5.5-2v-83q-14-5-26-12.5T396-396q-10-10-17.5-22T366-444h-84q-1 3-2 5.5t-2 4.5-2 4.5-2 4.5l30.5 30.5L349-350l44.5 44.5L424-275Zm253-241q1-3 2-5.5t2-4.5 2-4.5 2-4.5l-30.5-30.5-45-45-45-45L534-686q-2 1-4.5 2t-4.5 2q-2 1-4.5 1.5T516-679v85q14 4 26.5 12t22.5 18q10 10 18 22t12 26h82Zm115 84q20.4 0 34.2-13.8Q840-459.6 840-480q0-20.4-13.8-34.2Q812.4-528 792-528q-20.4 0-34.2 13.8Q744-500.4 744-480q0 20.4 13.8 34.2Q771.6-432 792-432Zm-312 0q20.4 0 34.2-13.8Q528-459.6 528-480q0-20.4-13.8-34.2Q500.4-528 480-528q-20.4 0-34.2 13.8Q432-500.4 432-480q0 20.4 13.8 34.2Q459.6-432 480-432Zm0 312q20.4 0 34.2-13.8Q528-147.6 528-168q0-20.4-13.8-34.2Q500.4-216 480-216q-20.4 0-34.2 13.8Q432-188.4 432-168q0 20.4 13.8 34.2Q459.6-120 480-120ZM168-432q20.4 0 34.2-13.8Q216-459.6 216-480q0-20.4-13.8-34.2Q188.4-528 168-528q-20.4 0-34.2 13.8Q120-500.4 120-480q0 20.4 13.8 34.2Q147.6-432 168-432Zm312-312q20.4 0 34.2-13.8Q528-771.6 528-792q0-20.4-13.8-34.2Q500.4-840 480-840q-20.4 0-34.2 13.8Q432-812.4 432-792q0 20.4 13.8 34.2Q459.6-744 480-744Z" />
    </svg>
  );
}

export function GraphIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 18 18"
      width="18"
      height="18"
      fill="currentColor"
      {...props}
    >
      <path d="M4.519 17.25q-.957 0-1.622-.666-.666-.665-.666-1.622 0-.956.666-1.621.665-.666 1.622-.666.262 0 .478.056.216.056.422.15l1.012-1.256q-.487-.562-.702-1.294-.216-.73-.104-1.462L4.2 8.399q-.32.47-.816.751-.497.281-1.096.281-.957 0-1.622-.665Q0 8.1 0 7.144q0-.957.666-1.623.665-.665 1.622-.665.956 0 1.622.665.665.666.665 1.623v.131L6 7.762q.375-.656.994-1.124.618-.47 1.406-.619V4.5q-.731-.206-1.209-.815-.479-.61-.479-1.397 0-.957.666-1.622Q8.044 0 9 0q.956 0 1.622.666.666.665.666 1.622 0 .787-.488 1.387t-1.2.806V6.02q.788.15 1.406.618.62.47.994 1.125l1.425-.487v-.131q0-.957.665-1.623.666-.665 1.622-.665.957 0 1.622.665.666.667.666 1.623t-.666 1.622q-.665.665-1.622.665-.6 0-1.096-.28-.497-.282-.816-.751l-1.425.469q.113.75-.103 1.472t-.703 1.284l1.012 1.238q.206-.094.422-.141.216-.047.478-.047.957 0 1.622.666.666.665.666 1.622 0 .956-.666 1.621-.665.666-1.622.666-.956 0-1.622-.666-.665-.665-.665-1.621 0-.376.112-.722.113-.347.32-.628l-1.013-1.238q-.75.412-1.622.412-.872 0-1.622-.412l-.994 1.238q.206.281.32.628.11.346.11.722 0 .956-.664 1.621-.666.666-1.622.666zM2.288 7.856q.3 0 .506-.206Q3 7.444 3 7.144q0-.3-.206-.506-.207-.207-.506-.207-.3 0-.507.207-.206.206-.206.506 0 .3.206.506.206.206.507.206zm2.23 7.82q.3 0 .507-.207.206-.207.206-.506 0-.3-.206-.507-.206-.206-.506-.206-.3 0-.507.206-.206.207-.206.507 0 .3.206.506.207.206.507.206zM9 3q.3 0 .506-.206.207-.206.207-.506 0-.3-.207-.507Q9.3 1.575 9 1.575q-.3 0-.506.206-.207.206-.207.507 0 .3.207.506Q8.7 3 9 3zm0 8.212q.769 0 1.303-.533.535-.535.535-1.304 0-.77-.535-1.303Q9.77 7.538 9 7.538q-.769 0-1.303.534-.534.534-.535 1.303 0 .769.535 1.303.534.534 1.303.534zm4.481 4.463q.3 0 .507-.206.206-.207.206-.506 0-.3-.206-.507-.207-.206-.507-.206-.3 0-.506.206-.206.207-.206.507 0 .3.206.506.206.206.506.206zm2.231-7.819q.3 0 .507-.206.206-.206.206-.506 0-.3-.206-.507-.206-.206-.507-.206-.3 0-.506.206-.206.207-.206.507 0 .3.206.506.206.206.506.206zM9 2.288zM2.288 7.144zM9 9.375zm6.712-2.23zM4.52 14.962zm8.962 0z" />
    </svg>
  );
}

export function PreviewIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 -960 960 960"
      width="20"
      height="20"
      fill="currentColor"
      {...props}
    >
      <path d="M216-144q-29.7 0-50.85-21.15Q144-186.3 144-216v-528q0-29.7 21.15-50.85Q186.3-816 216-816h528q29.7 0 50.85 21.15Q816-773.7 816-744v528q0 29.7-21.15 50.85Q773.7-144 744-144H216Zm0-72h528v-456H216v456Zm132-124.5Q290-381 264-444q26-63 84.12-103.5 58.11-40.5 132-40.5Q554-588 612-547.5T696-444q-26 63-84.12 103.5-58.11 40.5-132 40.5Q406-300 348-340.5Zm227.88-32.94Q618.76-398.88 643-444q-24.24-45.12-67.12-70.56Q533-540 480-540q-53 0-95.88 25.44Q341.24-489.12 317-444q24.24 45.12 67.12 70.56Q427-348 480-348q53 0 95.88-25.44ZM480-444Zm42.5 42.5Q540-419 540-444t-17.5-42.5Q505-504 480-504t-42.5 17.5Q420-469 420-444t17.5 42.5Q455-384 480-384t42.5-17.5Z" />
    </svg>
  );
}


