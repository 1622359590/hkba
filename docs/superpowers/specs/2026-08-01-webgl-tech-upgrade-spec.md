# HKBA 官网科技感升级方案 — WebGL 动画 + 视觉强化

> **目标：** 让网站一看就是高端区块链协会，充满科技感和信任感
> **核心库：** @react-three/fiber (Three.js) + react-tsparticles
> **日期：** 2026-08-01

---

## 1. 技术选型

| 效果 | 推荐库 | 说明 |
|---|---|---|
| Hero 背景 | **@react-three/fiber** | 六边形网格 + 发光粒子，区块链核心视觉 |
| 浮动粒子 | **react-tsparticles** | 轻量级粒子系统，用于全页面氛围 |
| 光效/辉光 | **@react-three/drei** | Three.js 辅助工具，含 Bloom、Lighting |
| 动画过渡 | **Framer Motion** | 页面切换、元素入场动画 |

### 安装命令

```bash
cd frontend
npm install @react-three/fiber @react-three/drei three react-tsparticles tsparticles framer-motion
npm install -D @types/three
```

---

## 2. Hero 区域重做 — 三层视觉结构

### 结构
```
┌─────────────────────────────────────────────────┐
│  Layer 3: 前景内容 (标题 + 副标题 + CTA)          │
│  ─────────────────────────────────────────────── │
│  Layer 2: CSS 渐变叠加 (品牌色光晕)               │
│  ─────────────────────────────────────────────── │
│  Layer 1: WebGL Canvas (六边形网格 + 粒子)        │
└─────────────────────────────────────────────────┘
```

### 2.1 六边形网格背景组件

创建 `frontend/src/components/webgl/HexGrid.tsx`:

```tsx
'use client'

import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Float } from '@react-three/drei'
import * as THREE from 'three'

// 六边形几何体
function Hexagon({ position, scale, delay }: { position: [number, number, number], scale: number, delay: number }) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const materialRef = useRef<THREE.MeshStandardMaterial>(null!)

  // 创建六边形形状
  const geometry = useMemo(() => {
    const shape = new THREE.Shape()
    const size = 1
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 6
      const x = size * Math.cos(angle)
      const y = size * Math.sin(angle)
      if (i === 0) shape.moveTo(x, y)
      else shape.lineTo(x, y)
    }
    shape.closePath()

    const extrudeSettings = { depth: 0.08, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02 }
    return new THREE.ExtrudeGeometry(shape, extrudeSettings)
  }, [])

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    // 呼吸发光效果
    const intensity = 0.15 + Math.sin(t * 0.8 + delay) * 0.1
    materialRef.current.emissiveIntensity = intensity
    // 微小上下浮动
    meshRef.current.position.y = position[1] + Math.sin(t * 0.5 + delay) * 0.15
  })

  return (
    <mesh ref={meshRef} position={position} scale={scale} geometry={geometry} rotation={[Math.PI / 2, 0, 0]}>
      <meshStandardMaterial
        ref={materialRef}
        color="#0a1628"
        emissive="#D9B656"
        emissiveIntensity={0.15}
        transparent
        opacity={0.6}
        wireframe={false}
      />
    </mesh>
  )
}

// 连接线 (区块链 "链" 的视觉隐喻)
function ConnectionLine({ start, end }: { start: [number, number, number], end: [number, number, number] }) {
  const ref = useRef<THREE.Line>(null!)

  const geometry = useMemo(() => {
    const points = [new THREE.Vector3(...start), new THREE.Vector3(...end)]
    return new THREE.BufferGeometry().setFromPoints(points)
  }, [start, end])

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    // @ts-ignore
    ref.current.material.opacity = 0.08 + Math.sin(t * 1.2) * 0.04
  })

  return (
    <line ref={ref} geometry={geometry}>
      <lineBasicMaterial color="#67E8F9" transparent opacity={0.1} />
    </line>
  )
}

// 浮动粒子
function Particles({ count = 80 }: { count?: number }) {
  const ref = useRef<THREE.Points>(null!)

  const [positions, colors] = useMemo(() => {
    const pos = new Float32Array(count * 3)
    const col = new Float32Array(count * 3)
    const gold = new THREE.Color('#D9B656')
    const cyan = new THREE.Color('#67E8F9')

    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 20
      pos[i * 3 + 1] = (Math.random() - 0.5) * 12
      pos[i * 3 + 2] = (Math.random() - 0.5) * 8

      const c = Math.random() > 0.5 ? gold : cyan
      col[i * 3] = c.r
      col[i * 3 + 1] = c.g
      col[i * 3 + 2] = c.b
    }
    return [pos, col]
  }, [count])

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    ref.current.rotation.y = t * 0.02
    ref.current.rotation.x = Math.sin(t * 0.1) * 0.05
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-color" count={count} array={colors} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.06} vertexColors transparent opacity={0.7} sizeAttenuation />
    </points>
  )
}

// 主场景
export default function HexGridScene() {
  // 生成六边形网格布局 (蜂窝状)
  const hexagons = useMemo(() => {
    const items: { pos: [number, number, number]; scale: number; delay: number }[] = []
    const size = 1.2
    const rows = 6
    const cols = 8

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = col * size * 1.75 + (row % 2 ? size * 0.875 : 0) - cols * size * 0.875
        const y = row * size * 1.5 - rows * size * 0.75
        const delay = (row + col) * 0.3
        const scale = 0.3 + Math.random() * 0.15
        items.push({ pos: [x, y, -2], scale, delay })
      }
    }
    return items
  }, [])

  // 生成连接线 (相邻六边形之间)
  const lines = useMemo(() => {
    const result: { start: [number, number, number]; end: [number, number, number] }[] = []
    // 简化：取部分相邻节点连线
    for (let i = 0; i < hexagons.length; i += 3) {
      if (i + 1 < hexagons.length) {
        result.push({ start: hexagons[i].pos, end: hexagons[i + 1].pos })
      }
    }
    return result
  }, [hexagons])

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
      <Canvas
        camera={{ position: [0, 0, 6], fov: 60 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >
        {/* 环境光 */}
        <ambientLight intensity={0.3} />
        <directionalLight position={[5, 5, 5]} intensity={0.5} color="#D9B656" />
        <pointLight position={[-5, 3, 2]} intensity={0.8} color="#67E8F9" distance={15} />

        {/* 六边形网格 */}
        {hexagons.map((h, i) => (
          <Hexagon key={i} position={h.pos} scale={h.scale} delay={h.delay} />
        ))}

        {/* 连接线 */}
        {lines.map((l, i) => (
          <ConnectionLine key={`line-${i}`} start={l.start} end={l.end} />
        ))}

        {/* 浮动粒子 */}
        <Particles count={100} />
      </Canvas>
    </div>
  )
}
```

### 2.2 Hero 组件重构

更新 `frontend/src/components/HomePageClient.tsx` 的 Hero 部分：

```tsx
// 导入
import dynamic from 'next/dynamic'
const HexGridScene = dynamic(() => import('./webgl/HexGrid'), { ssr: false })

// Hero Section JSX
<section className="hero-section">
  {/* Layer 1: WebGL 背景 */}
  <HexGridScene />

  {/* Layer 2: CSS 渐变叠加 */}
  <div className="hero-gradient-overlay" />

  {/* Layer 3: 前景内容 */}
  <div className="hero-content">
    <div className="hero-badge">
      <span className="hero-badge-dot" />
      香港區塊鏈協會
    </div>

    <h1 className="hero-title">
      <span className="hero-title-line1">HKBA</span>
      <span className="hero-title-line2">HongKong Blockchain Association</span>
    </h1>

    <p className="hero-description">
      致力於推動區塊鏈技術在香港及其周邊地區的發展，<br className="hidden-mobile" />
      並為人們提供一個交流和合作的平台。
    </p>

    <div className="hero-actions">
      <a href="/about" className="btn-accent btn-lg">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
        關於協會
      </a>
      <a href="/join" className="btn-secondary btn-lg">
        加入我們
      </a>
    </div>

    {/* 统计数字 */}
    <div className="hero-stats">
      <div className="hero-stat">
        <span className="hero-stat-number">200+</span>
        <span className="hero-stat-label">會員單位</span>
      </div>
      <div className="hero-stat-divider" />
      <div className="hero-stat">
        <span className="hero-stat-number">50+</span>
        <span className="hero-stat-label">行業活動</span>
      </div>
      <div className="hero-stat-divider" />
      <div className="hero-stat">
        <span className="hero-stat-number">5+</span>
        <span className="hero-stat-label">深耕年數</span>
      </div>
    </div>
  </div>
</section>
```

### 2.3 Hero CSS

```css
/* ═══ Hero Section ═══ */
.hero-section {
  position: relative;
  min-height: 100vh;
  display: flex;
  align-items: center;
  overflow: hidden;
  background: var(--bg);
}

.hero-gradient-overlay {
  position: absolute;
  inset: 0;
  z-index: 1;
  background:
    radial-gradient(ellipse 80% 50% at 25% 50%, rgba(217,182,86,0.06), transparent),
    radial-gradient(ellipse 60% 40% at 75% 40%, rgba(103,232,249,0.04), transparent),
    linear-gradient(180deg, transparent 0%, var(--bg) 100%);
  pointer-events: none;
}

.hero-content {
  position: relative;
  z-index: 2;
  max-width: 800px;
  padding: 120px 48px 80px;
  margin-left: max(48px, calc((100vw - 1440px) / 2 + 48px));
}

/* Badge */
.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: rgba(217,182,86,0.08);
  border: 1px solid rgba(217,182,86,0.2);
  border-radius: 999px;
  color: var(--gold);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.05em;
  margin-bottom: 32px;
  animation: fadeInUp 0.6s ease-out;
}

.hero-badge-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--gold);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(217,182,86,0.4); }
  50% { opacity: 0.8; box-shadow: 0 0 0 8px rgba(217,182,86,0); }
}

/* Title */
.hero-title {
  margin-bottom: 24px;
  animation: fadeInUp 0.6s ease-out 0.1s both;
}

.hero-title-line1 {
  display: block;
  font-size: clamp(3.5rem, 8vw, 7rem);
  font-weight: 900;
  letter-spacing: -0.03em;
  line-height: 1;
  background: linear-gradient(135deg, #FFFFFF 0%, #D9B656 50%, #67E8F9 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero-title-line2 {
  display: block;
  font-size: clamp(1rem, 2vw, 1.5rem);
  font-weight: 500;
  color: var(--text-2);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-top: 12px;
}

/* Description */
.hero-description {
  font-size: 18px;
  line-height: 1.8;
  color: var(--text-2);
  margin-bottom: 40px;
  max-width: 600px;
  animation: fadeInUp 0.6s ease-out 0.2s both;
}

/* Actions */
.hero-actions {
  display: flex;
  gap: 16px;
  margin-bottom: 64px;
  animation: fadeInUp 0.6s ease-out 0.3s both;
}

.btn-lg {
  padding: 14px 32px;
  font-size: 16px;
  border-radius: 12px;
}

/* Stats */
.hero-stats {
  display: flex;
  align-items: center;
  gap: 32px;
  animation: fadeInUp 0.6s ease-out 0.4s both;
}

.hero-stat {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.hero-stat-number {
  font-size: 32px;
  font-weight: 800;
  color: var(--gold);
  line-height: 1;
}

.hero-stat-label {
  font-size: 13px;
  color: var(--text-3);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.hero-stat-divider {
  width: 1px;
  height: 40px;
  background: linear-gradient(180deg, transparent, var(--border-subtle), transparent);
}

/* ═══ Mobile ═══ */
@media (max-width: 768px) {
  .hero-content {
    padding: 100px 24px 60px;
    margin-left: 0;
  }

  .hero-title-line1 {
    font-size: 3rem;
  }

  .hero-stats {
    flex-wrap: wrap;
    gap: 20px;
  }

  .hero-stat-divider {
    display: none;
  }

  .hero-actions {
    flex-direction: column;
  }

  .hero-actions .btn-lg {
    width: 100%;
    justify-content: center;
  }
}
```

---

## 3. 全站粒子氛围 — TSParticles

创建 `frontend/src/components/webgl/ParticleBackground.tsx`:

```tsx
'use client'

import { useCallback, useEffect, useState } from 'react'
import Particles from 'react-tsparticles'
import { loadSlim } from 'tsparticles-slim'
import type { Engine } from 'tsparticles-engine'

export default function ParticleBackground() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const particlesInit = useCallback(async (engine: Engine) => {
    await loadSlim(engine)
  }, [])

  if (!mounted) return null

  return (
    <Particles
      id="tsparticles"
      init={particlesInit}
      options={{
        fullScreen: { enable: false },
        fpsLimit: 60,
        particles: {
          number: { value: 40, density: { enable: true, area: 1000 } },
          color: { value: ['#D9B656', '#67E8F9'] },
          opacity: {
            value: { min: 0.1, max: 0.4 },
            animation: { enable: true, speed: 0.5, minimumValue: 0.1 }
          },
          size: {
            value: { min: 1, max: 3 },
            animation: { enable: true, speed: 1, minimumValue: 0.5 }
          },
          move: {
            enable: true,
            speed: 0.3,
            direction: 'none' as const,
            outModes: { default: 'out' as const }
          },
          links: {
            enable: true,
            distance: 150,
            color: '#D9B656',
            opacity: 0.06,
            width: 1
          }
        },
        detectRetina: true
      }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        pointerEvents: 'none'
      }}
    />
  )
}
```

在 `layout.tsx` 中引入（仅公网页面）：

```tsx
// 动态引入，避免 SSR 问题
const ParticleBackground = dynamic(() => import('./webgl/ParticleBackground'), { ssr: false })

// 在 ClientLayout 的公网分支中添加
{!isAdmin && <ParticleBackground />}
```

---

## 4. 卡片发光效果

### 4.1 鼠标跟随光效

创建 `frontend/src/components/ui/GlowCard.tsx`:

```tsx
'use client'

import { useRef, useState, type ReactNode, type MouseEvent } from 'react'

interface GlowCardProps {
  children: ReactNode
  className?: string
  glowColor?: string
}

export default function GlowCard({ children, className = '', glowColor = 'rgba(217,182,86,0.15)' }: GlowCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isHovered, setIsHovered] = useState(false)

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    setPosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    })
  }

  return (
    <div
      ref={cardRef}
      className={`glow-card ${className}`}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        '--glow-x': `${position.x}px`,
        '--glow-y': `${position.y}px`,
        '--glow-color': glowColor,
        '--glow-opacity': isHovered ? 1 : 0
      } as React.CSSProperties}
    >
      <div className="glow-card__effect" />
      {children}
    </div>
  )
}
```

```css
/* ═══ Glow Card ═══ */
.glow-card {
  position: relative;
  overflow: hidden;
}

.glow-card__effect {
  position: absolute;
  inset: 0;
  opacity: var(--glow-opacity, 0);
  transition: opacity 0.3s ease;
  pointer-events: none;
  background: radial-gradient(
    600px circle at var(--glow-x) var(--glow-y),
    var(--glow-color),
    transparent 40%
  );
  z-index: 1;
}

.glow-card > * {
  position: relative;
  z-index: 2;
}
```

### 4.2 使用方式

```tsx
// 替换原来的 glass-card
<GlowCard glowColor="rgba(217,182,86,0.12)">
  <div className="stat-card">
    <div className="stat-number">200+</div>
    <div className="stat-label">會員單位</div>
  </div>
</GlowCard>
```

---

## 5. Section 分割线 — 发光渐变线

```css
/* ═══ Section Divider ═══ */
.section-divider {
  position: relative;
  height: 1px;
  margin: 0 auto;
  max-width: 800px;
}

.section-divider::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent,
    var(--gold) 20%,
    var(--cyan) 50%,
    var(--gold) 80%,
    transparent
  );
  opacity: 0.3;
}

.section-divider::after {
  content: '';
  position: absolute;
  left: 50%;
  top: -4px;
  width: 8px;
  height: 8px;
  background: var(--gold);
  border-radius: 50%;
  transform: translateX(-50%);
  box-shadow: 0 0 12px var(--gold-glow);
}
```

---

## 6. 滚动视差效果

使用 Framer Motion 实现：

```tsx
'use client'

import { motion, useScroll, useTransform } from 'framer-motion'
import { useRef } from 'react'

export function ParallaxSection({ children, speed = 0.5 }: { children: ReactNode, speed?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start']
  })

  const y = useTransform(scrollYProgress, [0, 1], [0, speed * 100])

  return (
    <motion.div ref={ref} style={{ y }}>
      {children}
    </motion.div>
  )
}

// 使用
<ParallaxSection speed={0.3}>
  <section className="about-section">...</section>
</ParallaxSection>
```

---

## 7. 按钮升级 — 边框发光

```css
/* ═══ Glowing Buttons ═══ */
.btn-glow {
  position: relative;
  background: linear-gradient(135deg, var(--gold), var(--gold-dim));
  color: #06090F;
  font-weight: 700;
  border: none;
  border-radius: 12px;
  padding: 14px 32px;
  font-size: 16px;
  cursor: pointer;
  overflow: hidden;
  transition: all 0.3s ease;
}

.btn-glow::before {
  content: '';
  position: absolute;
  inset: -2px;
  background: linear-gradient(135deg, var(--gold), var(--cyan), var(--gold));
  border-radius: 14px;
  z-index: -1;
  opacity: 0;
  transition: opacity 0.3s ease;
  filter: blur(8px);
}

.btn-glow:hover::before {
  opacity: 1;
}

.btn-glow:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 32px var(--gold-glow);
}

/* 次要按钮发光 */
.btn-glow-secondary {
  position: relative;
  background: transparent;
  color: var(--text-1);
  font-weight: 600;
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  padding: 14px 32px;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-glow-secondary:hover {
  border-color: var(--gold);
  background: rgba(217,182,86,0.05);
  box-shadow: 0 0 20px rgba(217,182,86,0.1);
  transform: translateY(-2px);
}
```

---

## 8. 实施步骤 (给 Codex)

```bash
# Step 1: 安装依赖
cd frontend
npm install @react-three/fiber @react-three/drei three react-tsparticles tsparticles framer-motion
npm install -D @types/three

# Step 2: 创建组件目录
mkdir -p src/components/webgl

# Step 3: 按顺序实现
# 1. HexGrid.tsx (Hero 背景)
# 2. ParticleBackground.tsx (全站粒子)
# 3. GlowCard.tsx (卡片发光)
# 4. 更新 HomePageClient.tsx (引入新组件)
# 5. 更新 globals.css (新样式)
# 6. 更新 layout.tsx (引入 ParticleBackground)

# Step 4: 验证
npm run build
npm run dev
```

---

## 9. 性能优化注意

1. **WebGL 仅客户端渲染** — 所有 Three.js 组件使用 `dynamic(() => import(...), { ssr: false })`
2. **降低粒子数量** — 移动端减少到 30-40 个粒子
3. **requestAnimationFrame** — Three.js 自动处理，无需额外优化
4. **懒加载** — Hero 的 HexGrid 仅在视口内时渲染
5. **prefers-reduced-motion** — 尊重用户系统设置，减少动画

```tsx
// 在组件中检测
const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
if (prefersReduced) return null
```
