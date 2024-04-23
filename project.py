from flask import Flask, render_template, jsonify, request
import pandas as pd
import numpy as np
import pycountry
import warnings
warnings.filterwarnings("ignore", category=DeprecationWarning)


app = Flask(__name__)

# Global variable to hold the data sample
random_sample = None
start_date = None
end_date = None
fixed_start_date = None
fixed_end_date = None
songName = "all"

@app.route("/")
def index():
    return render_template("index.html")

def readdata():
    global start_date, end_date, fixed_end_date, fixed_start_date
    df = pd.read_csv("filtered_data.csv", index_col=False)
    df['snapshot_date'] = pd.to_datetime(df['snapshot_date'])
    start_date = df['snapshot_date'].min()
    end_date = df['snapshot_date'].max()
    fixed_start_date = start_date
    fixed_end_date = end_date
    return df

@app.route("/data")
def mainfunc():
    global random_sample, start_date, end_date, fixed_start_date, fixed_end_date, songName

    if random_sample is None:
        random_sample = readdata()

    filtered_sample = random_sample[(random_sample['snapshot_date'] >= start_date) & (random_sample['snapshot_date'] <= end_date)]

    ############################### Line Plot #########################################
    # Extract top 10 songs based on frequency and prepare data to show their frequency over time
    top_10_songs_overall = filtered_sample['name'].value_counts().head(10).index.tolist()
    top_10_songs_data = filtered_sample[filtered_sample['name'].isin(top_10_songs_overall)]

    number_of_days = end_date - start_date
    
    freq="number_of_days"

    if number_of_days.days <= 20:
        freq="D"
    elif number_of_days.days <= 90:
        freq="W"
    elif number_of_days.days <= 365:
        freq="M"

    # Group by week and by song name, then count occurrences
    song_frequency_over_time = top_10_songs_data.groupby([pd.Grouper(key='snapshot_date', freq=freq), 'name'])['country'].count().unstack(fill_value=0)
    song_frequency_over_time.reset_index(inplace=True)
    song_frequency_over_time['snapshot_date'] = song_frequency_over_time['snapshot_date'].dt.strftime('%Y-%m-%d')
    song_frequency_over_time_json = song_frequency_over_time.to_json(orient='records')

    ############################### Line Plot #########################################


    ############################### PCP Plot #########################################

    # Extract selected features for parallel coordinates plot
    selected_columns = ['danceability', 'energy', 'key', 'loudness',
                        'speechiness', 'acousticness', 
                        'liveness', 'valence', 'tempo']

    pcp_data=filtered_sample[selected_columns]
    np.random.seed(42)
    pcp_data = pcp_data.sample(n=500)
    pcp_data_json = pcp_data.to_json(orient='records')

    ############################### PCP Plot #########################################


    ############################### Map Plot #########################################

    if songName=="all":
        world_filtered_data = pd.read_csv("world_filtered_data.csv", index_col=False)

    else:
        world_filtered_data = pd.read_csv("world_filtered_data.csv", index_col=False)
        world_filtered_data = world_filtered_data[world_filtered_data['name'] == songName]

    world_filtered_data['snapshot_date'] = pd.to_datetime(world_filtered_data['snapshot_date'])

    world_filtered_data=world_filtered_data[(world_filtered_data['snapshot_date'] >= start_date) & (world_filtered_data['snapshot_date'] <= end_date)]

    # Filter to obtain the top 50 songs per day globally
    world_top_50_daily = world_filtered_data.groupby('snapshot_date').apply(
        lambda x: x.nsmallest(50, 'daily_rank')
    ).reset_index(drop=True)

    merged_data = pd.merge(
        world_top_50_daily[['name', 'snapshot_date']],
        filtered_sample[['name', 'snapshot_date', 'country']],
        on=['name', 'snapshot_date'],
        how='inner'
    )

    # Count the number of matching songs per country per day
    country_matches = merged_data.groupby(['snapshot_date', 'country']).size().unstack(fill_value=0)

    # Calculate the average number of matching songs per country
    average_matches = country_matches.mean().sort_values(ascending=False).to_frame(name='frequency')

    final_results = average_matches.reset_index()
    final_results.columns = ['country', 'frequency']

    country_counts = final_results

    # Mapping alpha-2 country codes to country names
    country_counts['country_name'] = country_counts['country'].apply(
        lambda x: pycountry.countries.get(alpha_2=x).name if pycountry.countries.get(alpha_2=x) else None
    )

    # Mapping alpha-2 country codes to numeric country codes
    country_counts['country_number'] = country_counts['country'].apply(
        lambda x: pycountry.countries.get(alpha_2=x).numeric if pycountry.countries.get(alpha_2=x) else None
    )

    # Remove rows with no country name or number code
    country_counts_cleaned = country_counts.dropna(subset=['country_name', 'country_number'])

    # Convert the cleaned country counts to a dictionary format that includes country name, numeric code, and frequency
    country_frequency_dict = country_counts_cleaned.set_index('country_number').to_dict('index')  

    ############################### Map Plot #########################################


    # Return JSON data for the client side
    return jsonify({
        "pcp_data": pcp_data_json,
        "song_frequency_over_time": song_frequency_over_time_json,
        "fixed_start_date":fixed_start_date,
        "fixed_end_date": fixed_end_date,
        "country_frequency_dict":country_frequency_dict
    })

@app.route('/update-date-range', methods=['POST'])
def update_date_range():
    global random_sample, start_date, end_date

    if request.is_json:
        data = request.get_json()
        start_date = pd.to_datetime(data.get('start_date'))
        end_date = pd.to_datetime(data.get('end_date'))

        return jsonify({"status": "success", "message": "Date range updated successfully."}), 200
    else:
        return jsonify({"error": "Request must be JSON"}), 400
    
@app.route('/update-selected-song', methods=['POST'])
def handle_data():
    global songName
    
    data = request.json
    songName=data['songName']

    return jsonify({"status": "success", "message": "Data received"})

if __name__ == "__main__":
    app.run(debug=True)
