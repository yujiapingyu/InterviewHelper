import { Client } from '@notionhq/client';
import dotenv from 'dotenv';

dotenv.config();

/**
 * 为指定用户创建Notion客户端
 * @param {Object} userNotionConfig - 用户的Notion配置 {notion_api_key, notion_database_id}
 * @returns {Object} {client, databaseId}
 */
function createUserNotionClient(userNotionConfig) {
  if (!userNotionConfig?.notion_api_key || !userNotionConfig?.notion_database_id) {
    return { client: null, databaseId: null };
  }
  
  const client = new Client({ auth: userNotionConfig.notion_api_key });
  return {
    client,
    databaseId: userNotionConfig.notion_database_id
  };
}

/**
 * Check if Notion integration is configured for a user
 * @param {Object} userNotionConfig - {notion_api_key, notion_database_id}
 */
export function isNotionEnabled(userNotionConfig) {
  return !!(userNotionConfig?.notion_api_key && userNotionConfig?.notion_database_id);
}

/**
 * Sync vocabulary note to Notion database
 * @param {Object} vocabularyData - Vocabulary data to sync
 * @param {Object} userNotionConfig - User's Notion configuration
 * @returns {Promise<Object>} Notion page response
 */
export async function syncVocabularyToNotion(vocabularyData, userNotionConfig) {
  console.log('🔵 syncVocabularyToNotion called with:', { word: vocabularyData.word });
  
  const { client: notion, databaseId } = createUserNotionClient(userNotionConfig);
  
  if (!notion || !databaseId) {
    console.log('⚠️ Notion integration not configured for this user, skipping sync');
    return null;
  }

  try {
    const { word, translation, explanation, example_sentences, tags } = vocabularyData;
    console.log('🔵 Processing vocabulary data:', { 
      word, 
      translation: translation?.substring(0, 30), 
      hasExplanation: !!explanation,
      exampleCount: example_sentences?.length || 0,
      tagCount: tags?.length || 0
    });

    // Prepare example sentences text
    let examplesText = '';
    if (example_sentences && example_sentences.length > 0) {
      examplesText = example_sentences
        .map((ex, idx) => `${idx + 1}. ${ex.japanese}\n   ${ex.chinese}`)
        .join('\n\n');
      console.log('🔵 Prepared examples text, length:', examplesText.length);
    }

    // Create properties for Notion database
    const properties = {
      '単語': {
        title: [
          {
            text: {
              content: word
            }
          }
        ]
      },
      '翻訳': {
        rich_text: [
          {
            text: {
              content: translation || ''
            }
          }
        ]
      },
      '解説': {
        rich_text: [
          {
            text: {
              content: explanation || ''
            }
          }
        ]
      },
      '例文': {
        rich_text: [
          {
            text: {
              content: examplesText || ''
            }
          }
        ]
      }
    };

    // Add tags if present
    if (tags && tags.length > 0) {
      properties['タグ'] = {
        multi_select: tags.map(tag => ({ name: tag }))
      };
    }

    // Create page in Notion database
    console.log('🔵 Creating Notion page with properties:', Object.keys(properties));
    console.log('🔵 Database ID:', databaseId);
    
    const response = await notion.pages.create({
      parent: {
        database_id: databaseId
      },
      properties
    });

    console.log(`✅ Synced to Notion: ${word}`);
    console.log('✅ Notion page ID:', response.id);
    return response;

  } catch (error) {
    console.error('❌ Failed to sync to Notion:', error.message);
    console.error('❌ Error code:', error.code);
    console.error('❌ Error body:', JSON.stringify(error.body, null, 2));
    console.error('❌ Full error:', error);
    throw error;
  }
}

/**
 * Delete vocabulary from Notion
 * @param {string} notionPageId - Notion page ID to delete
 * @param {Object} userNotionConfig - User's Notion configuration
 * @returns {Promise<Object>} Notion response
 */
export async function deleteVocabularyFromNotion(notionPageId, userNotionConfig) {
  const { client: notion } = createUserNotionClient(userNotionConfig);
  
  if (!notion || !notionPageId) {
    return null;
  }

  try {
    const response = await notion.pages.update({
      page_id: notionPageId,
      archived: true
    });

    console.log(`✅ Archived in Notion: ${notionPageId}`);
    return response;

  } catch (error) {
    console.error('❌ Failed to delete from Notion:', error.message);
    throw error;
  }
}

/**
 * Search for a vocabulary word in Notion database
 * @param {string} word - Word to search for
 * @param {Object} userNotionConfig - User's Notion configuration
 * @returns {Promise<Object|null>} Notion page if found
 */
export async function findVocabularyInNotion(word, userNotionConfig) {
  const { client: notion, databaseId } = createUserNotionClient(userNotionConfig);
  
  if (!notion || !databaseId) {
    return null;
  }

  try {
    const response = await notion.databases.query({
      database_id: databaseId,
      filter: {
        property: '単語',
        title: {
          equals: word
        }
      }
    });

    return response.results.length > 0 ? response.results[0] : null;

  } catch (error) {
    console.error('❌ Failed to search Notion:', error.message);
    return null;
  }
}

export default {
  isNotionEnabled,
  syncVocabularyToNotion,
  deleteVocabularyFromNotion,
  findVocabularyInNotion
};
