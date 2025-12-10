// Utilitaires pour la base de données Supabase
const supabase = require('../config/supabaseClient');

// Opérations sur les patients
const patientOperations = {
    getAll: async () => {
        const { data, error } = await supabase.from('patients').select('*');
        return { data, error };
    },

    getById: async (id) => {
        const { data, error } = await supabase
            .from('patients')
            .select('*')
            .eq('id', id)
            .single();
        return { data, error };
    },

    create: async (patient) => {
        const { data, error } = await supabase
            .from('patients')
            .insert([patient]);
        return { data, error };
    },

    update: async (id, updates) => {
        const { data, error } = await supabase
            .from('patients')
            .update(updates)
            .eq('id', id);
        return { data, error };
    },

    delete: async (id) => {
        const { data, error } = await supabase
            .from('patients')
            .delete()
            .eq('id', id);
        return { data, error };
    },
};

// Opérations sur les médecins
const medecinOperations = {
    getAll: async () => {
        const { data, error } = await supabase.from('medecins').select('*');
        return { data, error };
    },

    getById: async (id) => {
        const { data, error } = await supabase
            .from('medecins')
            .select('*')
            .eq('id', id)
            .single();
        return { data, error };
    },

    create: async (medecin) => {
        const { data, error } = await supabase
            .from('medecins')
            .insert([medecin]);
        return { data, error };
    },

    update: async (id, updates) => {
        const { data, error } = await supabase
            .from('medecins')
            .update(updates)
            .eq('id', id);
        return { data, error };
    },

    delete: async (id) => {
        const { data, error } = await supabase
            .from('medecins')
            .delete()
            .eq('id', id);
        return { data, error };
    },
};

// Opérations sur les rendez-vous
const appointmentOperations = {
    getAll: async () => {
        const { data, error } = await supabase
            .from('rendez_vous')
            .select('*, patients(*), medecins(*)');
        return { data, error };
    },

    getByPatientId: async (patientId) => {
        const { data, error } = await supabase
            .from('rendez_vous')
            .select('*, medecins(*)')
            .eq('patient_id', patientId);
        return { data, error };
    },

    getByMedecinId: async (medecinId) => {
        const { data, error } = await supabase
            .from('rendez_vous')
            .select('*, patients(*)')
            .eq('medecin_id', medecinId);
        return { data, error };
    },

    create: async (appointment) => {
        const { data, error } = await supabase
            .from('rendez_vous')
            .insert([appointment]);
        return { data, error };
    },

    update: async (id, updates) => {
        const { data, error } = await supabase
            .from('rendez_vous')
            .update(updates)
            .eq('id', id);
        return { data, error };
    },

    delete: async (id) => {
        const { data, error } = await supabase
            .from('rendez_vous')
            .delete()
            .eq('id', id);
        return { data, error };
    },
};

// Opérations sur les messages
const messageOperations = {
    getByConversation: async (patientId, medecinId) => {
        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .or(`and(patient_id.eq.${patientId},medecin_id.eq.${medecinId}),and(patient_id.eq.${medecinId},medecin_id.eq.${patientId})`)
            .order('created_at', { ascending: true });
        return { data, error };
    },

    create: async (message) => {
        const { data, error } = await supabase
            .from('messages')
            .insert([message]);
        return { data, error };
    },
};

module.exports = {
    patientOperations,
    medecinOperations,
    appointmentOperations,
    messageOperations,
};
