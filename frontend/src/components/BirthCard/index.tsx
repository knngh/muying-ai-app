import { useState } from 'react'
import { Modal } from 'antd'
import type { User } from '@/api/modules'
import { BirthDateForm } from './BirthDateForm'
import { TimelineAnimation } from './TimelineAnimation'

interface BirthCardProps {
  open: boolean
  onClose: () => void
  user: User | null
}

interface AnimationData {
  pregnancyStartDate: string
  birthDate: string
  babyGender?: string
}

export function BirthCard({ open, onClose, user }: BirthCardProps) {
  const [stage, setStage] = useState<'form' | 'animation'>('form')
  const [animationData, setAnimationData] = useState<AnimationData | null>(null)

  const handleFormComplete = (
    pregnancyStartDate: string,
    birthDate: string,
    babyGender?: string,
  ) => {
    setAnimationData({ pregnancyStartDate, birthDate, babyGender })
    setStage('animation')
  }

  const handleClose = () => {
    setStage('form')
    setAnimationData(null)
    onClose()
  }

  return (
    <Modal
      title={stage === 'form' ? '生成宝宝出生卡片' : '孕育旅程'}
      open={open}
      onCancel={handleClose}
      footer={null}
      width={560}
      destroyOnClose
    >
      {stage === 'form' && (
        <BirthDateForm user={user} onComplete={handleFormComplete} />
      )}
      {stage === 'animation' && animationData && (
        <TimelineAnimation
          pregnancyStartDate={animationData.pregnancyStartDate}
          birthDate={animationData.birthDate}
          babyGender={animationData.babyGender}
        />
      )}
    </Modal>
  )
}
