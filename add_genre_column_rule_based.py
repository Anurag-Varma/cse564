import pandas as pd
import random

def classify_genre_advanced(row):
    genres = ['Trap', 'Hiphop', 'Underground Rap', 'Dark Trap', 'hardstyle', 'techno', 'techhouse', 'Emo', 'Pop', 'Rap', 'RnB', 'dnb', 'psytrance', 'trance']
    if row['speechiness'] >= 0.13:
        if row['danceability'] > 0.75:
            return 'Trap' if row['energy'] > 0.6 else 'Hiphop'
        else:
            return 'Underground Rap' if row['acousticness'] > 0.5 else 'Dark Trap'
    elif row['instrumentalness'] > 0.01:
        if row['tempo'] > 120:
            return 'hardstyle'
        elif row['tempo'] >= 100:
            return 'techno'
        else:
            return 'techhouse'
    elif row['liveness'] > 0.45:
        return 'Emo'
    elif row['valence'] > 0.69:
        return 'Pop'
    elif row['energy'] > 0.7:
        return 'Rap'
    elif row['acousticness'] > 0.67:
        return 'RnB'
    elif row['tempo'] >= 120:
        return 'dnb'
    elif row['danceability'] > 0.3 and row['energy'] > 0.3:
        return 'psytrance' if row['tempo'] > 105 else 'trance'
    else:
        return random.choice(genres)  # default to a random genre if no condition is met

# Load your CSV
data_path = 'universal_top_spotify_songs.csv'  # Update this to the path of your CSV file
songs_data = pd.read_csv(data_path)

# Apply the classification
songs_data['genre'] = songs_data.apply(classify_genre_advanced, axis=1)

# Save the updated CSV
updated_file_path = 'universal_top_spotify_songs_new.csv'  # Update this to where you want to save the new CSV
songs_data.to_csv(updated_file_path, index=False)

print("Updated file saved at:", updated_file_path)

# Assuming 'column_name' is the column where you want to calculate frequencies
column_name = 'genre'

# Calculate frequency of values in the specified column
value_counts = songs_data[column_name].value_counts()

# Print the frequency of each unique value
print(value_counts)
