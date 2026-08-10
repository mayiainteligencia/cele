-- ============================================
-- BASE DE DATOS MAYIA - CONOCIMIENTO COMPLETO
-- ============================================

CREATE DATABASE IF NOT EXISTS mayia_dashboard;
USE mayia_dashboard;

-- ============================================
-- TABLA: DEPARTAMENTOS Y SERVICIOS
-- ============================================

CREATE TABLE IF NOT EXISTS departamentos (
  id INT PRIMARY KEY AUTO_INCREMENT,
  nombre VARCHAR(100) NOT NULL,
  descripcion TEXT,
  icono VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS servicios (
  id INT PRIMARY KEY AUTO_INCREMENT,
  departamento_id INT,
  nombre VARCHAR(200) NOT NULL,
  descripcion TEXT,
  precio DECIMAL(10,2),
  tipo ENUM('mipyme', 'consultor', 'infraestructura', 'otro') DEFAULT 'otro',
  disponible BOOLEAN DEFAULT TRUE,
  imagen_url VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (departamento_id) REFERENCES departamentos(id)
);

-- ============================================
-- TABLA: CURSOS ACADEMIA MAYIA (32 cursos)
-- ============================================

CREATE TABLE IF NOT EXISTS cursos_academia (
  id INT PRIMARY KEY AUTO_INCREMENT,
  titulo VARCHAR(200) NOT NULL,
  descripcion TEXT,
  duracion_horas DECIMAL(5,2),
  nivel ENUM('PRINCIPIANTE', 'INTERMEDIO', 'AVANZADO'),
  categoria ENUM('NEGOCIOS', 'TECH'),
  imagen_url VARCHAR(255),
  disponible BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLA: SERVICIOS CORPORATIVOS (Grid 3x3)
-- ============================================

CREATE TABLE IF NOT EXISTS servicios_corporativos (
  id INT PRIMARY KEY AUTO_INCREMENT,
  nombre VARCHAR(100) NOT NULL,
  titulo_corto VARCHAR(50),
  descripcion TEXT,
  logo_url VARCHAR(255),
  posicion INT, -- 1-9 para el grid
  categoria VARCHAR(50),
  disponible BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLA: INFORMACIÓN EMPRESARIAL
-- ============================================

CREATE TABLE IF NOT EXISTS info_empresa (
  id INT PRIMARY KEY AUTO_INCREMENT,
  empresa VARCHAR(100),
  descripcion TEXT,
  industria VARCHAR(100),
  fundacion YEAR,
  pais VARCHAR(50),
  sitio_web VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- INSERTAR DEPARTAMENTOS
-- ============================================

INSERT INTO departamentos (nombre, descripcion, icono) VALUES
('Recursos Humanos', 'Gestión inteligente de personal y capital humano', 'Users'),
('Finanzas y Contabilidad', 'Optimización financiera y análisis de ROI', 'DollarSign'),
('Operaciones', 'Automatización y eficiencia operativa', 'Settings'),
('Ventas y Marketing', 'Estrategia comercial inteligente y automatización', 'TrendingUp'),
('Tecnologías de la Información', 'Infraestructura y servicios cloud', 'Server'),
('Administración', 'Consultoría estratégica y gestión inteligente', 'Building2'),
('CiberSeguridad', 'Protección integral y monitoreo continuo', 'Shield'),
('Playground', 'Innovación y desarrollo experimental', 'Rocket');

-- ============================================
-- INSERTAR SERVICIOS POR DEPARTAMENTO
-- ============================================

-- RECURSOS HUMANOS
INSERT INTO servicios (departamento_id, nombre, descripcion, precio, tipo) VALUES
(1, 'Asesor en Recursos Humanos', 'IA especializada en gestión de personal y políticas laborales', 1900.00, 'mipyme'),
(1, 'Asesor en Seguridad en el Trabajo', 'Cumplimiento normativo y prevención de riesgos laborales', 1900.00, 'mipyme'),
(1, 'Empleados Digitales', 'Agentes IA que piensan, actúan y evolucionan con tu empresa', NULL, 'otro');

-- FINANZAS Y CONTABILIDAD
INSERT INTO servicios (departamento_id, nombre, descripcion, precio, tipo) VALUES
(2, 'Asesor IA Contable Fiscal', 'Automatización contable y fiscal para MIPYME', 1900.00, 'mipyme'),
(2, 'Automatiza Cobro y Facturación', 'Sistema inteligente de cobranza y facturación electrónica', NULL, 'otro'),
(2, 'Pagos y Detección de Fraudes', 'Seguridad financiera con IA para el sector financiero', NULL, 'otro'),
(2, 'Análisis de Toma de Decisión para Inversión', 'IA para análisis de inversiones y decisiones financieras', NULL, 'otro'),
(2, 'ROI IA - Consultor Digital', 'Cuantifica y mide resultados de negocio y ROI', 98000.00, 'consultor');

-- OPERACIONES
INSERT INTO servicios (departamento_id, nombre, descripcion, precio, tipo) VALUES
(3, 'Mantenimiento Predictivo', 'Prevención de fallos en manufactura con IA', NULL, 'otro'),
(3, 'Agentes de Supervisión y Control de Calidad', 'Supervisión automatizada de procesos de calidad', NULL, 'otro'),
(3, 'Control de CEDIS, Sucursales, Seguridad, Merma', 'Gestión integral de centros de distribución', NULL, 'otro'),
(3, 'Rutas y Logística Inteligente', 'Optimización de rutas y logística con IA', NULL, 'otro'),
(3, 'Análisis de Demanda y Control de Inventarios', 'Predicción de demanda y gestión de inventario', NULL, 'otro');

-- VENTAS Y MARKETING
INSERT INTO servicios (departamento_id, nombre, descripcion, precio, tipo) VALUES
(4, 'Recomendadora de Productos y Servicios', 'IA para sugerir productos personalizados', 1900.00, 'mipyme'),
(4, 'Compras Personalizadas y Recomendador', 'Experiencias de compra adaptadas con IA en Retail', NULL, 'otro'),
(4, 'Agentes Especializados en Atención a Cliente', 'Servicio al cliente automatizado con IA', NULL, 'otro'),
(4, 'Automatiza WhatsApp', 'Automatización inteligente de conversaciones en WhatsApp', 1900.00, 'mipyme');

-- TECNOLOGÍAS DE LA INFORMACIÓN
INSERT INTO servicios (departamento_id, nombre, descripcion, precio, tipo) VALUES
(5, 'GPU\'s AaaS, SaaS', 'Acceso a GPUs como servicio para IA', NULL, 'infraestructura'),
(5, 'Kubernetes', 'Orquestación de contenedores para IA', NULL, 'infraestructura'),
(5, 'Nube IA NoteBooks', 'Entornos de desarrollo para ciencia de datos', NULL, 'infraestructura'),
(5, 'Storage / Nube Privada', 'Almacenamiento seguro y nube privada', NULL, 'infraestructura'),
(5, 'Colocation', 'Ambiente ideal para tu infraestructura de IA', NULL, 'infraestructura'),
(5, 'Flai - Nube Mexicana para IA', 'Primera nube mexicana diseñada para Inteligencia Artificial', NULL, 'infraestructura'),
(5, 'Data Center IA Ready', 'Infraestructura NVIDIA alojada en EdgeNET', NULL, 'infraestructura'),
(5, 'Laboratorios y Pruebas de Concepto', 'Entornos para validar soluciones de IA', NULL, 'infraestructura');

-- ADMINISTRACIÓN
INSERT INTO servicios (departamento_id, nombre, descripcion, precio, tipo) VALUES
(6, 'ESTRATEGIA IA - Consultor Digital', 'Portafolio de sistemas de IA y evolución de competencias', 98000.00, 'consultor'),
(6, 'INNOVACIÓN EMPRESARIAL - Consultor Digital', 'Democratiza la innovación con autogeneración de ideas', 98000.00, 'consultor'),
(6, 'Business Consulting', 'Enfoque holístico: personas, procesos y tecnología', NULL, 'consultor'),
(6, 'Asesor ISO 9001', 'Cumplimiento normativo y gestión de calidad', 1900.00, 'mipyme'),
(6, 'Operadora Con IA', 'Automatización de operaciones administrativas', 1900.00, 'mipyme');

-- CIBERSEGURIDAD
INSERT INTO servicios (departamento_id, nombre, descripcion, precio, tipo) VALUES
(7, 'CIBER RIESGO - Consultor Digital', 'Portafolio estratégico de ciberseguridad', 98000.00, 'consultor'),
(7, 'Soluciones de Ciberseguridad - Técnico IA', 'Protección integral para MIPYME', 1900.00, 'mipyme'),
(7, 'Centro de Ciberresiliencia para IA', 'Protección especializada para Inteligencia Artificial', NULL, 'otro'),
(7, 'Monitoreo 24/7 en I.A. NOC', 'Vigilancia física y virtual continua', NULL, 'otro'),
(7, 'ISO 27001', 'Certificación y cumplimiento normativo de seguridad', NULL, 'otro'),
(7, 'Ciberseguridad Avanzada', 'Supervisión 24/7 con estándares de seguridad avanzada', NULL, 'otro');

-- PLAYGROUND
INSERT INTO servicios (departamento_id, nombre, descripcion, precio, tipo) VALUES
(8, 'Científicos de Datos', 'Centro de I+D interno para desarrollo de soluciones', NULL, 'otro'),
(8, 'Laboratorios de Pruebas de Concepto', 'Validación y desarrollo de soluciones innovadoras', NULL, 'otro'),
(8, 'Hackathon / Startups / Especialistas', 'Ecosistema de innovación y colaboración', NULL, 'otro'),
(8, 'IA Robotics', 'Desarrollo de soluciones robóticas con IA', NULL, 'otro'),
(8, 'Gaming', 'Aplicaciones de IA en gaming', NULL, 'otro'),
(8, 'Quantum', 'Investigación en computación cuántica', NULL, 'otro');

-- ============================================
-- INSERTAR CURSOS ACADEMIA (32 CURSOS)
-- ============================================

-- CURSOS DE NEGOCIOS (9 cursos)
INSERT INTO cursos_academia (titulo, descripcion, duracion_horas, nivel, categoria) VALUES
('Fundamentos del Prompting', 'Aprende ingeniería de prompts efectivos y casos de uso técnico', 4, 'PRINCIPIANTE', 'NEGOCIOS'),
('IA para Trabajo Inteligente', 'Integra IA en procesos de trabajo, automatización y gestión', 25, 'INTERMEDIO', 'NEGOCIOS'),
('Comunicación Efectiva en Equipo', 'Fortalece comunicación en reuniones y transmisión de información', 10, 'INTERMEDIO', 'NEGOCIOS'),
('Priorización y Delegación', 'Estrategias para priorizar y delegar efectivamente', 10, 'INTERMEDIO', 'NEGOCIOS'),
('IA para Gerentes', 'Acelera adopción de IA: fundamentos, ROI y gobernanza', 30, 'AVANZADO', 'NEGOCIOS'),
('Gestión del Cambio', 'Reduce resistencia y fomenta innovación en procesos', 15, 'AVANZADO', 'NEGOCIOS'),
('Toma de Decisiones Estratégicas', 'Decisiones basadas en datos alineadas al negocio', 6, 'AVANZADO', 'NEGOCIOS'),
('Optimización de Procesos', 'Mejora desempeño y eficiencia de equipos', 12, 'AVANZADO', 'NEGOCIOS'),
('Desarrollo de Talento Humano', 'Gestión de talento, cultura y contratación', 15, 'AVANZADO', 'NEGOCIOS');

-- CURSOS TECH (23 cursos)
INSERT INTO cursos_academia (titulo, descripcion, duracion_horas, nivel, categoria) VALUES
('Programación Asistida por IA', 'Código, pruebas y optimización con agentes de IA', 20, 'INTERMEDIO', 'TECH'),
('Django REST Framework', 'Diseña APIs robustas con autenticación', 40, 'AVANZADO', 'TECH'),
('Python Fundamentos', 'Sintaxis, bucles, funciones y proyectos reales', 30, 'PRINCIPIANTE', 'TECH'),
('Django Web Development', 'Aplicaciones dinámicas y lógica de negocios', 20, 'INTERMEDIO', 'TECH'),
('Docker para Python', 'Contenerización y orquestación con Docker', 10, 'INTERMEDIO', 'TECH'),
('Fundamentos de LLMs', 'Prompting, RAG y LLMs de código abierto', 30, 'AVANZADO', 'TECH'),
('Flask Web Apps', 'Framework Flask y construcción de API REST', 16, 'INTERMEDIO', 'TECH'),
('SQL Básico', 'Gestión de bases de datos y consultas', 30, 'PRINCIPIANTE', 'TECH'),
('SQL Avanzado', 'Análisis complejo y métricas de negocio', 30, 'AVANZADO', 'TECH'),
('Machine Learning Fundamentos', 'Modelos predictivos con Scikit-learn', 40, 'INTERMEDIO', 'TECH'),
('Computer Vision', 'Clasificación de imágenes con redes neuronales', 40, 'AVANZADO', 'TECH'),
('Tableau Visualización', 'Dashboards e informes interactivos', 25, 'INTERMEDIO', 'TECH'),
('Data Wrangling', 'Limpieza y transformación de datos', 25, 'INTERMEDIO', 'TECH'),
('Álgebra Lineal', 'Fundamentos para ciencia de datos', 40, 'AVANZADO', 'TECH'),
('ML para Textos', 'Análisis de sentimientos y BERT', 40, 'AVANZADO', 'TECH'),
('ML para Negocios', 'Aplicación de ML a problemas empresariales', 40, 'AVANZADO', 'TECH'),
('Métodos Numéricos en ML', 'Descenso por gradiente y boosting', 30, 'AVANZADO', 'TECH'),
('Habilidades Blandas', 'Pensamiento crítico y comunicación', 2.5, 'PRINCIPIANTE', 'TECH'),
('Análisis Estadístico', 'Métodos estadísticos y prueba de hipótesis', 40, 'INTERMEDIO', 'TECH'),
('Aprendizaje Supervisado', 'Optimización de hiperparámetros y métricas', 40, 'AVANZADO', 'TECH'),
('Python para Análisis', 'Variables, bucles, Pandas y preprocesamiento', 32, 'PRINCIPIANTE', 'TECH'),
('Series Temporales', 'Tendencias, estacionalidad y pronósticos', 30, 'AVANZADO', 'TECH'),
('Aprendizaje No Supervisado', 'K-means y detección de anomalías', 30, 'AVANZADO', 'TECH');

-- ============================================
-- INSERTAR SERVICIOS CORPORATIVOS (Grid 3x3)
-- ============================================

INSERT INTO servicios_corporativos (nombre, titulo_corto, descripcion, posicion, categoria) VALUES
('Centro de Datos EdgeNET', 'Centro de Datos', 'Migra tus datos a EdgeNET. Infraestructura de clase mundial con soberanía de datos garantizada en México.', 1, 'infraestructura'),
('FLAI - Nube Mexicana', 'NUBE', 'Migra a la nube de FLAI. La primera nube mexicana diseñada específicamente para Inteligencia Artificial.', 2, 'infraestructura'),
('MAYIA - Plataforma de IA', 'MAYIA', 'Integra IA en tu empresa. Automatiza procesos, optimiza decisiones y aumenta productividad hasta 300%.', 3, 'ia'),
('Protección Avanzada 24/7', 'Ciberseguridad', 'Protección avanzada 24/7. Monitoreo continuo, detección de amenazas y respuesta inmediata ante incidentes.', 4, 'seguridad'),
('Academia MAYIA', 'Academia de IA', 'Capacita a tu equipo en IA. 32 cursos especializados para dominar las herramientas del futuro.', 5, 'educacion'),
('Video Vigilancia Inteligente', 'VSaaS', 'Video vigilancia inteligente sin inversión extra. Compatible con tus cámaras actuales, potenciado con IA.', 6, 'seguridad'),
('Recuperación ante Desastres', 'DRP', 'Plan de Recuperación ante Desastres. Garantiza continuidad operativa y protege tu negocio ante cualquier contingencia.', 7, 'continuidad'),
('Certificaciones Internacionales', 'ISOs', 'Certificaciones ISO 27001, 9001. Cumplimiento normativo y estándares internacionales de calidad y seguridad.', 8, 'certificaciones'),
('Inteligencia de Negocios', 'Analytics', 'Inteligencia de negocios con IA. Transforma tus datos en decisiones estratégicas con análisis predictivo avanzado.', 9, 'analytics');

-- ============================================
-- INSERTAR INFORMACIÓN DE MABE
-- ============================================

INSERT INTO info_empresa (empresa, descripcion, industria, fundacion, pais, sitio_web) VALUES
('MABE', 'MABE es una empresa mexicana líder en la fabricación de electrodomésticos con presencia en América Latina. Fundada en 1946, ofrece productos innovadores para cocción, refrigeración, lavado y climatización. Con el eslogan "Cuando tu hogar funciona, funciona todo", MABE se enfoca en mejorar la vida de las familias a través de tecnología de vanguardia, diseño y eficiencia energética. La empresa cuenta con plantas de manufactura en varios países y distribuye sus productos bajo marcas reconocidas como MABE, GE Appliances (en Latinoamérica) y otras alianzas estratégicas.', 'Electrodomésticos y Línea Blanca', 1946, 'México', 'https://www.mabe.com.mx');

-- ============================================
-- TABLAS DEMO ORIGINALES (Mantener para RH, etc)
-- ============================================

CREATE TABLE IF NOT EXISTS empleados (
  id INT PRIMARY KEY AUTO_INCREMENT,
  nombre VARCHAR(100) NOT NULL,
  puesto VARCHAR(100),
  departamento VARCHAR(50),
  salario DECIMAL(10,2),
  fecha_ingreso DATE,
  email VARCHAR(100),
  telefono VARCHAR(20),
  status ENUM('activo', 'vacaciones', 'baja') DEFAULT 'activo',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS presupuestos (
  id INT PRIMARY KEY AUTO_INCREMENT,
  departamento VARCHAR(50),
  categoria VARCHAR(50),
  monto_asignado DECIMAL(12,2),
  monto_gastado DECIMAL(12,2),
  periodo VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ventas (
  id INT PRIMARY KEY AUTO_INCREMENT,
  cliente VARCHAR(100),
  producto VARCHAR(100),
  monto DECIMAL(10,2),
  vendedor VARCHAR(100),
  fecha DATE,
  status ENUM('cerrada', 'en-proceso', 'perdida') DEFAULT 'en-proceso',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inventario (
  id INT PRIMARY KEY AUTO_INCREMENT,
  producto VARCHAR(100),
  categoria VARCHAR(50),
  cantidad INT,
  ubicacion VARCHAR(50),
  precio_unitario DECIMAL(10,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tickets_ti (
  id INT PRIMARY KEY AUTO_INCREMENT,
  titulo VARCHAR(200),
  descripcion TEXT,
  prioridad ENUM('baja', 'media', 'alta', 'critica') DEFAULT 'media',
  status ENUM('abierto', 'en-proceso', 'resuelto') DEFAULT 'abierto',
  reportado_por VARCHAR(100),
  asignado_a VARCHAR(100),
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Datos demo
INSERT INTO empleados (nombre, puesto, departamento, salario, fecha_ingreso, email, telefono, status) VALUES
('Ana García', 'Gerente de RH', 'Recursos Humanos', 45000.00, '2020-03-15', 'ana.garcia@mabe.com', '555-0101', 'activo'),
('Carlos López', 'Contador Senior', 'Finanzas', 42000.00, '2019-06-20', 'carlos.lopez@mabe.com', '555-0102', 'activo'),
('María Rodríguez', 'Jefe de Ventas', 'Ventas', 48000.00, '2021-01-10', 'maria.rodriguez@mabe.com', '555-0103', 'activo');
