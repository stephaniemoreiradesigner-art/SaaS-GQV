ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS cargo text;
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS salario numeric(10,2);
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS ativo boolean DEFAULT true;
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS nivel_hierarquico text;
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS departamento text;
ALTER TABLE financeiro ADD COLUMN IF NOT EXISTS colaborador_id uuid REFERENCES colaboradores(id);
ALTER TABLE financeiro ADD COLUMN IF NOT EXISTS competencia text;
