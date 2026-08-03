import "./PageHeader.css";

interface PageHeaderProps {
  title: string;
  description?: string;
  centered?: boolean;
}

export function PageHeader({ title, description, centered }: PageHeaderProps) {
  return (
    <header className={"page-header" + (centered ? " page-header--centered" : "")}>
      <h1>{title}</h1>
      {description && <p className="page-header__desc">{description}</p>}
    </header>
  );
}
