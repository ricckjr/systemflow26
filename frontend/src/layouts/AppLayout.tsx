import React from 'react'
import { MainLayout as Layout } from '@/components/layout'
import { Outlet } from 'react-router-dom'

const AppLayout: React.FC = () => {
  return (
    <Layout>
      <Outlet />
    </Layout>
  )
}

export default AppLayout
