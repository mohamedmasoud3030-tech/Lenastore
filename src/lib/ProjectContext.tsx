import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { useAuth } from './AuthContext';

export interface Project {
  id: string;
  name: string;
  location: string;
  manager_name: string;
  start_date: string;
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
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProject = async () => {
    if (!supabase || !user) {
      setProject(null);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', user.id)
        .limit(1)
        .single();
      
      if (error && error.code !== 'PGRST116') { // not found is ok
        console.error('Error fetching project:', error);
      }
      
      setProject(data || null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProject();
  }, [user]);

  return (
    <ProjectContext.Provider value={{ project, loading, refreshProject: fetchProject }}>
      {children}
    </ProjectContext.Provider>
  );
};

export const useProject = () => useContext(ProjectContext);
