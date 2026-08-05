import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { useAuth } from './AuthContext';

export interface Project {
  id: string;
  name: string;
  location: string | null;
  manager_name: string | null;
  phone: string | null;
  start_date: string;
  owner_name: string | null;
  currency: string;
}

interface ProjectContextType {
  project: Project | null;
  loading: boolean;
  refreshProject: () => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType>({
  project: null,
  loading: true,
  refreshProject: async () => {},
});

export const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [project, setProject] = useState<Project | null>(null);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);

  const fetchProject = useCallback(async () => {
    if (!userId) {
      setProject(null);
      setLoadedUserId(null);
      setFetching(false);
      return;
    }

    setFetching(true);

    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();

      if (error) {
        throw error;
      }

      setProject(data ?? null);
      setLoadedUserId(userId);
    } catch (error) {
      console.error('Error fetching project:', error);
      setProject(null);
      setLoadedUserId(userId);
    } finally {
      setFetching(false);
    }
  }, [userId]);

  useEffect(() => {
    void fetchProject();
  }, [fetchProject]);

  const loading = Boolean(userId && (fetching || loadedUserId !== userId));

  return (
    <ProjectContext.Provider value={{ project, loading, refreshProject: fetchProject }}>
      {children}
    </ProjectContext.Provider>
  );
};

export const useProject = () => useContext(ProjectContext);
