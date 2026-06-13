import { create } from 'zustand'
import { ServiceOrder } from '@/types'

interface ServiceState {
  services: ServiceOrder[]
  currentService: ServiceOrder | null
  setServices: (services: ServiceOrder[]) => void
  setCurrentService: (service: ServiceOrder | null) => void
  updateServiceStatus: (id: string, status: ServiceOrder['status']) => void
}

export const useServiceStore = create<ServiceState>((set) => ({
  services: [],
  currentService: null,
  setServices: (services) => set({ services }),
  setCurrentService: (currentService) => set({ currentService }),
  updateServiceStatus: (id, status) =>
    set((state) => ({
      services: state.services.map((service) =>
        service.id === id ? { ...service, status } : service
      ),
    })),
}))
