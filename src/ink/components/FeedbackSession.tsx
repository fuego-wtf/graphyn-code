import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import TextInput from 'ink-text-input';
import { colors, fuegoColors } from '../theme/colors.js';

interface FeedbackSessionProps {
  taskTitle: string;
  onSubmit: (rating: number, comment: string) => void;
  onSkip?: () => void;
}

export const FeedbackSession: React.FC<FeedbackSessionProps> = ({ 
  taskTitle, 
  onSubmit, 
  onSkip 
}) => {
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [showComment, setShowComment] = useState(false);

  useInput((input, key) => {
    if (key.escape && onSkip) {
      onSkip();
    }
  });

  const handleRatingSelect = useCallback((item: { value: string }) => {
    const selectedRating = parseInt(item.value, 10);
    setRating(selectedRating);
    setShowComment(true);
  }, []);

  const handleCommentSubmit = useCallback(() => {
    if (rating !== null) {
      onSubmit(rating, comment);
    }
  }, [rating, comment, onSubmit]);

  const ratingItems = [
    { label: '⭐ 1 - Poor', value: '1' },
    { label: '⭐⭐ 2 - Fair', value: '2' },
    { label: '⭐⭐⭐ 3 - Good', value: '3' },
    { label: '⭐⭐⭐⭐ 4 - Very Good', value: '4' },
    { label: '⭐⭐⭐⭐⭐ 5 - Excellent', value: '5' }
  ];

  const renderStars = (count: number) => {
    return '⭐'.repeat(count) + '☆'.repeat(5 - count);
  };

  return (
    <Box flexDirection="column" paddingY={1}>
      <Box marginBottom={1}>
        <Text color={fuegoColors.text.primary} bold>
          Task Completed: {taskTitle}
        </Text>
      </Box>

      <Box borderStyle="round" borderColor={fuegoColors.border.subtle} paddingX={2} paddingY={1}>
        {!showComment ? (
          <Box flexDirection="column">
            <Text color={fuegoColors.text.primary}>
              How satisfied are you with the completion of this task?
            </Text>
            <SelectInput 
              items={ratingItems} 
              onSelect={handleRatingSelect}
              indicatorComponent={({ isSelected }) => (
                <Text color={isSelected ? fuegoColors.text.primary : fuegoColors.text.secondary}>
                  {isSelected ? '▶ ' : '  '}
                </Text>
              )}
            />
            <Box marginTop={1}>
              <Text color={fuegoColors.text.dimmed} dimColor>
                Press ESC to skip feedback
              </Text>
            </Box>
          </Box>
        ) : (
          <Box flexDirection="column">
            <Box marginBottom={1}>
              <Text color={colors.success}>
                Rating: {renderStars(rating!)} ({rating}/5)
              </Text>
            </Box>
            <Box marginBottom={1}>
              <Text color={fuegoColors.text.primary}>
                Any additional comments? (optional)
              </Text>
            </Box>
            <Box>
              <Text color={fuegoColors.text.primary}>{'> '}</Text>
              <TextInput 
                value={comment} 
                onChange={setComment}
                onSubmit={handleCommentSubmit}
                placeholder="Press Enter to submit..."
              />
            </Box>
            <Box marginTop={1}>
              <Text color={fuegoColors.text.dimmed} dimColor>
                Press Enter to submit or ESC to skip comments
              </Text>
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
};