const { supabase } = require('../config/supabase');
const TABLE = 'attachment_images';

const findByEntity = async (entityType, entityId) => {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
};

const countByUserAndEntity = async (uploadedByUserId, entityType, entityId) => {
  const { count, error } = await supabase
    .from(TABLE)
    .select('*', { count: 'exact', head: true })
    .eq('uploaded_by_user_id', uploadedByUserId)
    .eq('entity_type', entityType)
    .eq('entity_id', entityId);

  if (error) throw error;
  return count || 0;
};

const createMany = async (rows) => {
  const { data, error } = await supabase.from(TABLE).insert(rows).select('*');
  if (error) throw error;
  return data || [];
};

const findByIdForEntity = async (imageId, entityType, entityId) => {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('id', imageId)
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .maybeSingle();

  if (error) throw error;
  return data || null;
};

const deleteById = async (imageId, entityType, entityId) => {
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq('id', imageId)
    .eq('entity_type', entityType)
    .eq('entity_id', entityId);

  if (error) throw error;
};

const deleteByEntity = async (entityType, entityId) => {
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq('entity_type', entityType)
    .eq('entity_id', entityId);

  if (error) throw error;
};

module.exports = {
  findByEntity,
  countByUserAndEntity,
  createMany,
  findByIdForEntity,
  deleteById,
  deleteByEntity,
};
