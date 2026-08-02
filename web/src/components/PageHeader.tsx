import "./PageHeader.css";

interface PageHeaderProps {
  title: string;
  description?: string;
}

export function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <header className="page-header">
      <h1>{title}</h1>
      {description && <p className="page-header__desc">{description}</p>}
    </header>
  );
}
